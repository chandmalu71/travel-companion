/**
 * Expense Splitting Routes
 *
 * Handles shared expense splitting, settlement calculation, and payment tracking.
 *
 * Routes:
 * - POST /api/trips/:tripId/expenses/:expenseId/split — create/update split for an expense
 * - GET  /api/trips/:tripId/balances — get net balances for all trip members
 * - GET  /api/trips/:tripId/settlements — get settlement summary (simplified debts)
 * - POST /api/trips/:tripId/settlements/:settlementId/pay — mark partial/full payment
 * - GET  /api/trips/:tripId/split-preferences — get user's split preference for this trip
 * - PUT  /api/trips/:tripId/split-preferences — save split preference
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

export interface ExpenseSplittingOptions {
  db: Kysely<Database>;
}

export async function registerExpenseSplittingRoutes(
  app: FastifyInstance,
  options: ExpenseSplittingOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips/:tripId/expenses/:expenseId/split ─────────────────
  // Create or update per-member splits for a shared expense
  app.post(
    '/api/trips/:tripId/expenses/:expenseId/split',
    async (
      request: FastifyRequest<{
        Params: { tripId: string; expenseId: string };
        Body: {
          splitType: 'equal' | 'percentage' | 'per_item';
          members: Array<{
            memberId: string;
            percentage?: number;
            amount?: number;
            items?: string[];
          }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId, expenseId } = request.params;
      const { splitType, members } = request.body;

      // Verify expense exists and belongs to this trip
      const expense = await db
        .selectFrom('expenses')
        .select(['id', 'amount', 'currency', 'user_id', 'trip_id'])
        .where('id', '=', expenseId)
        .where('trip_id', '=', tripId)
        .executeTakeFirst();

      if (!expense) {
        return reply.status(404).send({ statusCode: 404, error: 'Expense not found in this trip' });
      }

      // Validate split
      const expenseAmount = Number(expense.amount);
      if (splitType === 'percentage') {
        const totalPct = members.reduce((sum, m) => sum + (m.percentage ?? 0), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          return reply.status(400).send({ statusCode: 400, error: 'Percentages must sum to 100' });
        }
      }

      // Delete existing splits for this expense
      await db.deleteFrom('expense_split_members').where('expense_id', '=', expenseId).execute();

      // Create new splits
      const splitRows = members.map((m) => {
        let amount: string | null = null;
        if (splitType === 'equal') {
          amount = (expenseAmount / members.length).toFixed(2);
        } else if (splitType === 'percentage' && m.percentage) {
          amount = ((expenseAmount * m.percentage) / 100).toFixed(2);
        } else if (splitType === 'per_item' && m.amount) {
          amount = m.amount.toFixed(2);
        }

        return {
          expense_id: expenseId,
          member_id: m.memberId,
          split_type: splitType,
          percentage: m.percentage ? String(m.percentage) : null,
          amount,
          items: m.items ? JSON.stringify(m.items) : null,
        };
      });

      if (splitRows.length > 0) {
        await db.insertInto('expense_split_members').values(splitRows).execute();
      }

      // Mark expense as shared
      await db.updateTable('expenses').set({ is_shared: true }).where('id', '=', expenseId).execute();

      // Save split preference for next time
      await db
        .insertInto('split_preferences')
        .values({
          user_id: userId,
          trip_id: tripId,
          default_split_type: splitType,
          default_included_members: JSON.stringify(members.map((m) => m.memberId)),
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'trip_id']).doUpdateSet({
            default_split_type: splitType,
            default_included_members: JSON.stringify(members.map((m) => m.memberId)),
            updated_at: sql`NOW()`,
          }),
        )
        .execute()
        .catch(() => {}); // Non-critical

      return reply.status(201).send({
        statusCode: 201,
        data: { expenseId, splitType, memberCount: members.length },
      });
    },
  );

  // ─── GET /api/trips/:tripId/balances ───────────────────────────────────
  // Returns net balance for each trip member (who owes whom)
  app.get(
    '/api/trips/:tripId/balances',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const { tripId } = request.params;

      // Get all shared expenses for this trip with their splits
      const expenses = await db
        .selectFrom('expenses')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('is_shared', '=', true)
        .execute();

      const expenseIds = expenses.map((e) => e.id);

      const splitMembers =
        expenseIds.length > 0
          ? await db
              .selectFrom('expense_split_members')
              .selectAll()
              .where('expense_id', 'in', expenseIds)
              .execute()
          : [];

      // Get group members for this trip
      const groups = await db
        .selectFrom('expense_groups')
        .selectAll()
        .where('trip_id', '=', tripId)
        .execute();

      const groupIds = groups.map((g) => g.id);
      const members =
        groupIds.length > 0
          ? await db
              .selectFrom('group_members')
              .selectAll()
              .where('group_id', 'in', groupIds)
              .execute()
          : [];

      // Calculate balances: for each expense, payer paid full amount, each split member owes their share
      // Net balance = total paid by member - total owed by member
      const balances = new Map<string, number>(); // member_id → net balance (positive = owed to them)

      for (const member of members) {
        balances.set(member.id, 0);
      }

      for (const expense of expenses) {
        const payerId = expense.payer_id ?? expense.user_id;
        const expenseSplits = splitMembers.filter((sm) => sm.expense_id === expense.id);

        if (expenseSplits.length === 0) continue;

        // Find the payer's member_id
        const payerMember = members.find((m) => m.user_id === payerId);
        if (!payerMember) continue;

        const totalAmount = Number(expense.amount);

        // Payer gets credit for paying full amount
        balances.set(payerMember.id, (balances.get(payerMember.id) ?? 0) + totalAmount);

        // Each split member owes their share
        for (const split of expenseSplits) {
          const owedAmount = Number(split.amount ?? 0);
          balances.set(split.member_id, (balances.get(split.member_id) ?? 0) - owedAmount);
        }
      }

      // Get existing settlements to adjust balances
      const settlements =
        groupIds.length > 0
          ? await db
              .selectFrom('settlements')
              .selectAll()
              .where('group_id', 'in', groupIds)
              .execute()
          : [];

      for (const s of settlements) {
        const paid = Number(s.amount_paid ?? 0);
        if (paid > 0) {
          // from_member paid to_member
          balances.set(s.from_member_id, (balances.get(s.from_member_id) ?? 0) + paid);
          balances.set(s.to_member_id, (balances.get(s.to_member_id) ?? 0) - paid);
        }
      }

      // Build response
      const memberBalances = members.map((m) => ({
        memberId: m.id,
        userId: m.user_id,
        name: m.name,
        balance: Number((balances.get(m.id) ?? 0).toFixed(2)),
      }));

      return reply.send({ statusCode: 200, data: { balances: memberBalances, currency: expenses[0]?.currency ?? 'EUR' } });
    },
  );

  // ─── GET /api/trips/:tripId/settlements ────────────────────────────────
  // Returns simplified settlement summary (minimize transactions)
  app.get(
    '/api/trips/:tripId/settlements',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const { tripId } = request.params;

      // Get balances first (reuse logic)
      const expenses = await db
        .selectFrom('expenses')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('is_shared', '=', true)
        .execute();

      const expenseIds = expenses.map((e) => e.id);
      const splitMembers =
        expenseIds.length > 0
          ? await db.selectFrom('expense_split_members').selectAll().where('expense_id', 'in', expenseIds).execute()
          : [];

      const groups = await db.selectFrom('expense_groups').selectAll().where('trip_id', '=', tripId).execute();
      const groupIds = groups.map((g) => g.id);
      const members =
        groupIds.length > 0
          ? await db.selectFrom('group_members').selectAll().where('group_id', 'in', groupIds).execute()
          : [];

      // Calculate raw balances
      const balances = new Map<string, number>();
      for (const member of members) balances.set(member.id, 0);

      for (const expense of expenses) {
        const payerId = expense.payer_id ?? expense.user_id;
        const expenseSplits = splitMembers.filter((sm) => sm.expense_id === expense.id);
        if (expenseSplits.length === 0) continue;
        const payerMember = members.find((m) => m.user_id === payerId);
        if (!payerMember) continue;
        balances.set(payerMember.id, (balances.get(payerMember.id) ?? 0) + Number(expense.amount));
        for (const split of expenseSplits) {
          balances.set(split.member_id, (balances.get(split.member_id) ?? 0) - Number(split.amount ?? 0));
        }
      }

      // Factor in existing settlements
      const existingSettlements =
        groupIds.length > 0
          ? await db.selectFrom('settlements').selectAll().where('group_id', 'in', groupIds).execute()
          : [];

      for (const s of existingSettlements) {
        const paid = Number(s.amount_paid ?? 0);
        if (paid > 0) {
          balances.set(s.from_member_id, (balances.get(s.from_member_id) ?? 0) + paid);
          balances.set(s.to_member_id, (balances.get(s.to_member_id) ?? 0) - paid);
        }
      }

      // Simplify debts: greedy algorithm to minimize transactions
      const debtors: Array<{ id: string; amount: number }> = [];
      const creditors: Array<{ id: string; amount: number }> = [];

      for (const [memberId, balance] of balances.entries()) {
        if (balance < -0.01) debtors.push({ id: memberId, amount: -balance });
        else if (balance > 0.01) creditors.push({ id: memberId, amount: balance });
      }

      debtors.sort((a, b) => b.amount - a.amount);
      creditors.sort((a, b) => b.amount - a.amount);

      const simplifiedDebts: Array<{
        from: { memberId: string; name: string; userId: string | null };
        to: { memberId: string; name: string; userId: string | null };
        amount: number;
        settlementId?: string;
        amountPaid: number;
        settled: boolean;
      }> = [];

      let di = 0;
      let ci = 0;
      while (di < debtors.length && ci < creditors.length) {
        const debtor = debtors[di]!;
        const creditor = creditors[ci]!;
        const transfer = Math.min(debtor.amount, creditor.amount);
        const fromMember = members.find((m) => m.id === debtor.id);
        const toMember = members.find((m) => m.id === creditor.id);

        // Check if there's an existing settlement record
        const existingS = existingSettlements.find(
          (s) => s.from_member_id === debtor.id && s.to_member_id === creditor.id,
        );

        simplifiedDebts.push({
          from: { memberId: debtor.id, name: fromMember?.name ?? 'Unknown', userId: fromMember?.user_id ?? null },
          to: { memberId: creditor.id, name: toMember?.name ?? 'Unknown', userId: toMember?.user_id ?? null },
          amount: Number(transfer.toFixed(2)),
          settlementId: existingS?.id,
          amountPaid: Number(existingS?.amount_paid ?? 0),
          settled: existingS?.settled ?? false,
        });

        debtor.amount -= transfer;
        creditor.amount -= transfer;
        if (debtor.amount < 0.01) di++;
        if (creditor.amount < 0.01) ci++;
      }

      return reply.send({
        statusCode: 200,
        data: {
          settlements: simplifiedDebts,
          totalSharedExpenses: expenses.reduce((sum, e) => sum + Number(e.amount), 0),
          currency: expenses[0]?.currency ?? 'EUR',
          memberCount: members.length,
        },
      });
    },
  );

  // ─── POST /api/trips/:tripId/settlements/:settlementId/pay ─────────────
  // Record a partial or full payment
  app.post(
    '/api/trips/:tripId/settlements/:settlementId/pay',
    async (
      request: FastifyRequest<{
        Params: { tripId: string; settlementId: string };
        Body: { amount: number; notes?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { settlementId } = request.params;
      const { amount, notes } = request.body;

      const settlement = await db
        .selectFrom('settlements')
        .selectAll()
        .where('id', '=', settlementId)
        .executeTakeFirst();

      if (!settlement) {
        return reply.status(404).send({ statusCode: 404, error: 'Settlement not found' });
      }

      const newAmountPaid = Number(settlement.amount_paid ?? 0) + amount;
      const totalOwed = Number(settlement.amount);
      const isFullySettled = newAmountPaid >= totalOwed - 0.01;

      await db
        .updateTable('settlements')
        .set({
          amount_paid: String(newAmountPaid),
          settled: isFullySettled,
          settled_at: isFullySettled ? new Date() : null,
          notes: notes ?? settlement.notes,
        })
        .where('id', '=', settlementId)
        .execute();

      return reply.send({
        statusCode: 200,
        data: {
          settlementId,
          amountPaid: newAmountPaid,
          totalOwed,
          remaining: Math.max(0, totalOwed - newAmountPaid),
          settled: isFullySettled,
        },
      });
    },
  );

  // ─── GET /api/trips/:tripId/split-preferences ─────────────────────────
  app.get(
    '/api/trips/:tripId/split-preferences',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;

      const pref = await db
        .selectFrom('split_preferences')
        .selectAll()
        .where('user_id', '=', userId)
        .where('trip_id', '=', tripId)
        .executeTakeFirst();

      return reply.send({
        statusCode: 200,
        data: pref
          ? {
              splitType: pref.default_split_type,
              includedMembers: pref.default_included_members ? JSON.parse(pref.default_included_members) : null,
            }
          : null,
      });
    },
  );

  // ─── PUT /api/trips/:tripId/split-preferences ─────────────────────────
  app.put(
    '/api/trips/:tripId/split-preferences',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Body: { splitType: string; includedMembers?: string[] };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const { splitType, includedMembers } = request.body;

      await db
        .insertInto('split_preferences')
        .values({
          user_id: userId,
          trip_id: tripId,
          default_split_type: splitType,
          default_included_members: includedMembers ? JSON.stringify(includedMembers) : null,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'trip_id']).doUpdateSet({
            default_split_type: splitType,
            default_included_members: includedMembers ? JSON.stringify(includedMembers) : null,
            updated_at: sql`NOW()`,
          }),
        )
        .execute();

      return reply.send({ statusCode: 200, message: 'Split preferences saved' });
    },
  );
}
