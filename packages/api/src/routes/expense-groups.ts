/**
 * Group Expense Splitting Routes
 *
 * Supports creating groups, splitting expenses (equal, percentage, per-item),
 * calculating net balances, and marking debts as settled.
 *
 * Routes:
 * - POST /api/trips/:tripId/groups - Create an expense group
 * - GET /api/trips/:tripId/groups/:groupId/balances - Get net balances
 * - POST /api/expenses/:expenseId/split - Split an expense
 * - PUT /api/settlements/:settlementId - Mark a debt as settled
 *
 * Implements Requirements: 21.1-21.10
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SplitType = 'equal' | 'percentage' | 'per_item';

interface CreateGroupBody {
  name: string;
  memberUserIds: string[];
}

interface SplitExpenseBody {
  groupId: string;
  splitType: SplitType;
  splits?: Array<{
    userId: string;
    amount?: number;
    percentage?: number;
  }>;
}

interface ExpenseGroupRoutesOptions {
  db: Kysely<Database>;
}

export interface MemberBalance {
  userId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface SettlementSuggestion {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerExpenseGroupRoutes(
  app: FastifyInstance,
  options: ExpenseGroupRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips/:tripId/groups ────────────────────────────────────

  app.post(
    '/api/trips/:tripId/groups',
    async (
      request: FastifyRequest<{ Params: { tripId: string }; Body: CreateGroupBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const { name, memberUserIds } = request.body;

      if (!name || name.length > 100) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Group name is required (max 100 chars)',
        });
      }

      // Ensure creator is included in members
      const allMembers = [...new Set([userId, ...memberUserIds])];

      const group = await db
        .insertInto('expense_groups')
        .values({
          trip_id: tripId,
          name,
          created_by: userId,
        })
        .returning(['id', 'name', 'trip_id', 'created_at'])
        .executeTakeFirstOrThrow();

      // Add all members
      for (const memberId of allMembers) {
        await db
          .insertInto('group_members')
          .values({
            group_id: group.id,
            user_id: memberId,
          })
          .execute();
      }

      return reply.status(201).send({
        statusCode: 201,
        data: {
          ...group,
          members: allMembers,
        },
      });
    },
  );

  // ─── GET /api/trips/:tripId/groups/:groupId/balances ───────────────────

  app.get(
    '/api/trips/:tripId/groups/:groupId/balances',
    async (
      request: FastifyRequest<{ Params: { tripId: string; groupId: string } }>,
      reply: FastifyReply,
    ) => {
      const { groupId } = request.params;

      // Get group members
      const members = await db
        .selectFrom('group_members')
        .innerJoin('users', 'users.id', 'group_members.user_id')
        .select(['group_members.user_id', 'users.display_name'])
        .where('group_members.group_id', '=', groupId)
        .execute();

      if (members.length === 0) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Get all splits for this group
      const splits = await db
        .selectFrom('expense_splits')
        .innerJoin('expenses', 'expenses.id', 'expense_splits.expense_id')
        .select([
          'expense_splits.user_id',
          'expense_splits.amount',
          'expenses.user_id as payer_id',
          'expenses.converted_amount',
        ])
        .where('expense_splits.group_id', '=', groupId)
        .execute();

      // Calculate balances
      const balances = calculateNetBalances(members, splits);
      const settlements = calculateSettlements(balances);

      return reply.send({
        statusCode: 200,
        data: {
          groupId,
          balances,
          settlements,
          currency: 'USD',
        },
      });
    },
  );

  // ─── POST /api/expenses/:expenseId/split ───────────────────────────────

  app.post(
    '/api/expenses/:expenseId/split',
    async (
      request: FastifyRequest<{ Params: { expenseId: string }; Body: SplitExpenseBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { expenseId } = request.params;
      const { groupId, splitType, splits } = request.body;

      // Get the expense
      const expense = await db
        .selectFrom('expenses')
        .select(['id', 'amount', 'converted_amount', 'user_id'])
        .where('id', '=', expenseId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!expense) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Expense not found',
        });
      }

      // Get group members
      const members = await db
        .selectFrom('group_members')
        .select('user_id')
        .where('group_id', '=', groupId)
        .execute();

      if (members.length < 2) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Group must have at least 2 members',
        });
      }

      const totalAmount = expense.converted_amount ?? expense.amount;
      let splitAmounts: Array<{ userId: string; amount: number }>;

      if (splitType === 'equal') {
        splitAmounts = splitEqually(totalAmount, members.map((m) => m.user_id));
      } else if (splitType === 'percentage') {
        if (!splits) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'Percentage splits must provide split details',
          });
        }

        const totalPct = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'Percentages must sum to 100',
          });
        }

        splitAmounts = splits.map((s) => ({
          userId: s.userId,
          amount: Math.round(totalAmount * (s.percentage ?? 0) / 100 * 100) / 100,
        }));
      } else if (splitType === 'per_item') {
        if (!splits) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'Per-item splits must provide split details',
          });
        }
        splitAmounts = splits.map((s) => ({
          userId: s.userId,
          amount: s.amount ?? 0,
        }));
      } else {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'splitType must be "equal", "percentage", or "per_item"',
        });
      }

      // Delete existing splits for this expense in this group
      await db
        .deleteFrom('expense_splits')
        .where('expense_id', '=', expenseId)
        .where('group_id', '=', groupId)
        .execute();

      // Insert new splits
      for (const split of splitAmounts) {
        await db
          .insertInto('expense_splits')
          .values({
            expense_id: expenseId,
            group_id: groupId,
            user_id: split.userId,
            amount: split.amount,
            split_type: splitType,
          })
          .execute();
      }

      return reply.status(201).send({
        statusCode: 201,
        data: {
          expenseId,
          groupId,
          splitType,
          splits: splitAmounts,
        },
      });
    },
  );

  // ─── PUT /api/settlements/:settlementId ────────────────────────────────

  app.put(
    '/api/settlements/:settlementId',
    async (
      request: FastifyRequest<{
        Params: { settlementId: string };
        Body: { settled: boolean };
      }>,
      reply: FastifyReply,
    ) => {
      const { settlementId } = request.params;
      const { settled } = request.body;

      await db
        .updateTable('settlements')
        .set({
          settled: settled ?? true,
          settled_at: settled ? new Date() : null,
          updated_at: new Date(),
        })
        .where('id', '=', settlementId)
        .execute();

      return reply.send({
        statusCode: 200,
        message: settled ? 'Debt marked as settled' : 'Settlement reverted',
      });
    },
  );
}

// ─── Business Logic (exported for property tests) ────────────────────────────

/**
 * Split an amount equally among members.
 * Distributes remainder (due to rounding) to the first members.
 */
export function splitEqually(
  totalAmount: number,
  memberIds: string[],
): Array<{ userId: string; amount: number }> {
  const n = memberIds.length;
  const baseAmount = Math.floor((totalAmount * 100) / n) / 100;
  const remainder = Math.round((totalAmount - baseAmount * n) * 100);

  return memberIds.map((userId, index) => ({
    userId,
    amount: index < remainder ? baseAmount + 0.01 : baseAmount,
  }));
}

/**
 * Calculate net balances for all group members.
 * Positive balance = owed money (paid more than fair share)
 * Negative balance = owes money (paid less than fair share)
 */
export function calculateNetBalances(
  members: Array<{ user_id: string; display_name: string | null }>,
  splits: Array<{
    user_id: string;
    amount: number;
    payer_id: string;
    converted_amount: number | null;
  }>,
): MemberBalance[] {
  const balanceMap = new Map<string, { paid: number; owed: number }>();

  for (const member of members) {
    balanceMap.set(member.user_id, { paid: 0, owed: 0 });
  }

  for (const split of splits) {
    const payerBalance = balanceMap.get(split.payer_id);
    if (payerBalance) {
      payerBalance.paid += split.amount;
    }

    const memberBalance = balanceMap.get(split.user_id);
    if (memberBalance) {
      memberBalance.owed += split.amount;
    }
  }

  return members.map((m) => {
    const balance = balanceMap.get(m.user_id) ?? { paid: 0, owed: 0 };
    return {
      userId: m.user_id,
      displayName: m.display_name ?? 'Unknown',
      totalPaid: Math.round(balance.paid * 100) / 100,
      totalOwed: Math.round(balance.owed * 100) / 100,
      netBalance: Math.round((balance.paid - balance.owed) * 100) / 100,
    };
  });
}

/**
 * Calculate minimal settlement transfers from net balances.
 */
export function calculateSettlements(balances: MemberBalance[]): SettlementSuggestion[] {
  const settlements: SettlementSuggestion[] = [];

  const debtors = balances
    .filter((b) => b.netBalance < 0)
    .map((b) => ({ userId: b.userId, amount: Math.abs(b.netBalance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netBalance > 0)
    .map((b) => ({ userId: b.userId, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;

    const transfer = Math.min(debtor.amount, creditor.amount);

    if (transfer > 0.01) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: Math.round(transfer * 100) / 100,
        currency: 'USD',
      });
    }

    debtor.amount -= transfer;
    creditor.amount -= transfer;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return settlements;
}
