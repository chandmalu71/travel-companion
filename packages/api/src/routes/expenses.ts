/**
 * Expense Tracking Routes
 *
 * CRUD operations for expenses with currency conversion,
 * budget tracking, and category-based aggregation.
 *
 * Routes:
 * - POST /api/expenses - Create a new expense
 * - GET /api/expenses - List user's expenses (with optional trip filter)
 * - GET /api/trips/:tripId/expenses/summary - Get expense summary for a trip
 * - PUT /api/expenses/:expenseId - Update an expense
 * - DELETE /api/expenses/:expenseId - Delete an expense
 * - PUT /api/trips/:tripId/budget - Set trip budget
 * - POST /api/trips/:tripId/expenses/export - Export expenses (PDF/CSV)
 *
 * Implements Requirements: 18.1, 18.2, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.13, 18.14, 18.17
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type CurrencyService } from '../services/currency.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'food_drink',
  'transport',
  'accommodation',
  'activities',
  'shopping',
  'health',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

interface CreateExpenseBody {
  amount: number; // 0.01 - 999,999,999.99
  currency: string; // ISO 4217
  category: ExpenseCategory;
  date: string; // ISO date
  merchantName?: string;
  notes?: string; // max 500 chars
  tripId?: string;
  bookingId?: string;
}

interface UpdateExpenseBody {
  amount?: number;
  currency?: string;
  category?: ExpenseCategory;
  date?: string;
  merchantName?: string;
  notes?: string;
  tripId?: string;
  bookingId?: string;
}

interface SetBudgetBody {
  budget: number; // 0.01 - 999,999,999.99
  currency: string;
}

interface ExpenseRoutesOptions {
  db: Kysely<Database>;
  currencyService: CurrencyService;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerExpenseRoutes(
  app: FastifyInstance,
  options: ExpenseRoutesOptions,
): Promise<void> {
  const { db, currencyService } = options;

  // ─── POST /api/expenses ────────────────────────────────────────────────

  app.post(
    '/api/expenses',
    async (request: FastifyRequest<{ Body: CreateExpenseBody }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const body = request.body;

      // Validate
      const errors = validateExpense(body);
      if (errors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Invalid expense data',
          details: { errors },
        });
      }

      try {
        // Convert to home currency (USD default)
        let convertedAmount = body.amount;
        let homeCurrency = 'USD';

        if (body.currency.toUpperCase() !== 'USD') {
          const conversion = await currencyService.convert(body.amount, body.currency, 'USD');
          convertedAmount = conversion.convertedAmount;
          homeCurrency = conversion.to;
        }

        const expense = await db
          .insertInto('expenses')
          .values({
            user_id: userId,
            trip_id: body.tripId ?? null,
            booking_id: body.bookingId ?? null,
            amount: body.amount,
            currency: body.currency.toUpperCase(),
            converted_amount: convertedAmount,
            home_currency: homeCurrency,
            category: body.category,
            date: body.date,
            merchant_name: body.merchantName ?? null,
            notes: body.notes ?? null,
          })
          .returning(['id', 'amount', 'currency', 'converted_amount', 'home_currency', 'category', 'date', 'merchant_name', 'notes', 'trip_id', 'created_at'])
          .executeTakeFirstOrThrow();

        // Check budget thresholds if expense is linked to a trip
        if (body.tripId) {
          await checkBudgetThresholds(db, body.tripId, userId);
        }

        return reply.status(201).send({
          statusCode: 201,
          data: expense,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create expense');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to create expense',
        });
      }
    },
  );

  // ─── GET /api/expenses ─────────────────────────────────────────────────

  app.get(
    '/api/expenses',
    async (
      request: FastifyRequest<{
        Querystring: { tripId?: string; category?: string; limit?: string; offset?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId, category, limit = '50', offset = '0' } = request.query;

      let query = db
        .selectFrom('expenses')
        .selectAll()
        .where('user_id', '=', userId)
        .orderBy('date', 'desc')
        .limit(Math.min(parseInt(limit, 10) || 50, 100))
        .offset(parseInt(offset, 10) || 0);

      if (tripId) {
        query = query.where('trip_id', '=', tripId);
      }
      if (category && EXPENSE_CATEGORIES.includes(category as ExpenseCategory)) {
        query = query.where('category', '=', category);
      }

      const expenses = await query.execute();

      return reply.send({
        statusCode: 200,
        data: expenses,
        pagination: {
          limit: parseInt(limit, 10) || 50,
          offset: parseInt(offset, 10) || 0,
          count: expenses.length,
        },
      });
    },
  );

  // ─── GET /api/trips/:tripId/expenses/summary ───────────────────────────

  app.get(
    '/api/trips/:tripId/expenses/summary',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;

      const expenses = await db
        .selectFrom('expenses')
        .selectAll()
        .where('user_id', '=', userId)
        .where('trip_id', '=', tripId)
        .execute();

      // Aggregate by category
      const categoryTotals: Record<string, number> = {};
      let grandTotal = 0;

      for (const expense of expenses) {
        const cat = expense.category;
        const amount = expense.converted_amount ?? expense.amount;
        categoryTotals[cat] = (categoryTotals[cat] ?? 0) + amount;
        grandTotal += amount;
      }

      // Get budget
      const trip = await db
        .selectFrom('trips')
        .select(['budget', 'budget_currency'])
        .where('id', '=', tripId)
        .where('owner_id', '=', userId)
        .executeTakeFirst();

      const budget = trip?.budget ?? null;
      const budgetCurrency = trip?.budget_currency ?? 'USD';
      const budgetUsedPercent = budget ? Math.round((grandTotal / budget) * 100) : null;

      // Daily breakdown
      const dailyTotals: Record<string, number> = {};
      for (const expense of expenses) {
        const day = expense.date;
        const amount = expense.converted_amount ?? expense.amount;
        dailyTotals[day] = (dailyTotals[day] ?? 0) + amount;
      }

      return reply.send({
        statusCode: 200,
        data: {
          tripId,
          grandTotal: Math.round(grandTotal * 100) / 100,
          homeCurrency: 'USD',
          categoryTotals,
          dailyTotals,
          expenseCount: expenses.length,
          budget,
          budgetCurrency,
          budgetUsedPercent,
        },
      });
    },
  );

  // ─── PUT /api/expenses/:expenseId ──────────────────────────────────────

  app.put(
    '/api/expenses/:expenseId',
    async (
      request: FastifyRequest<{ Params: { expenseId: string }; Body: UpdateExpenseBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { expenseId } = request.params;
      const body = request.body;

      // Verify ownership
      const existing = await db
        .selectFrom('expenses')
        .select(['id', 'trip_id'])
        .where('id', '=', expenseId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Expense not found',
        });
      }

      const updateFields: Record<string, unknown> = { updated_at: new Date() };

      if (body.amount !== undefined) updateFields['amount'] = body.amount;
      if (body.currency !== undefined) updateFields['currency'] = body.currency.toUpperCase();
      if (body.category !== undefined) updateFields['category'] = body.category;
      if (body.date !== undefined) updateFields['date'] = body.date;
      if (body.merchantName !== undefined) updateFields['merchant_name'] = body.merchantName;
      if (body.notes !== undefined) updateFields['notes'] = body.notes;
      if (body.tripId !== undefined) updateFields['trip_id'] = body.tripId;
      if (body.bookingId !== undefined) updateFields['booking_id'] = body.bookingId;

      // Recalculate conversion if amount or currency changed
      if (body.amount !== undefined || body.currency !== undefined) {
        const newAmount = body.amount ?? (existing as any).amount;
        const newCurrency = body.currency?.toUpperCase() ?? 'USD';

        if (newCurrency !== 'USD') {
          const conversion = await currencyService.convert(newAmount, newCurrency, 'USD');
          updateFields['converted_amount'] = conversion.convertedAmount;
          updateFields['home_currency'] = 'USD';
        } else {
          updateFields['converted_amount'] = newAmount;
          updateFields['home_currency'] = 'USD';
        }
      }

      const updated = await db
        .updateTable('expenses')
        .set(updateFields)
        .where('id', '=', expenseId)
        .where('user_id', '=', userId)
        .returning(['id', 'amount', 'currency', 'converted_amount', 'home_currency', 'category', 'date', 'merchant_name', 'notes', 'trip_id'])
        .executeTakeFirst();

      // Recheck budget thresholds
      const tripId = body.tripId ?? existing.trip_id;
      if (tripId) {
        await checkBudgetThresholds(db, tripId, userId);
      }

      return reply.send({ statusCode: 200, data: updated });
    },
  );

  // ─── DELETE /api/expenses/:expenseId ───────────────────────────────────

  app.delete(
    '/api/expenses/:expenseId',
    async (
      request: FastifyRequest<{ Params: { expenseId: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { expenseId } = request.params;

      const existing = await db
        .selectFrom('expenses')
        .select(['id', 'trip_id'])
        .where('id', '=', expenseId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Expense not found',
        });
      }

      await db.deleteFrom('expenses').where('id', '=', expenseId).execute();

      // Recheck budget thresholds
      if (existing.trip_id) {
        await checkBudgetThresholds(db, existing.trip_id, userId);
      }

      return reply.send({ statusCode: 200, message: 'Expense deleted' });
    },
  );

  // ─── PUT /api/trips/:tripId/budget ─────────────────────────────────────

  app.put(
    '/api/trips/:tripId/budget',
    async (
      request: FastifyRequest<{ Params: { tripId: string }; Body: SetBudgetBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const { budget, currency } = request.body;

      if (!budget || budget < 0.01 || budget > 999999999.99) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Budget must be between 0.01 and 999,999,999.99',
        });
      }

      const trip = await db
        .selectFrom('trips')
        .select('id')
        .where('id', '=', tripId)
        .where('owner_id', '=', userId)
        .executeTakeFirst();

      if (!trip) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Trip not found or you are not the owner',
        });
      }

      await db
        .updateTable('trips')
        .set({
          budget,
          budget_currency: currency?.toUpperCase() ?? 'USD',
          updated_at: new Date(),
        })
        .where('id', '=', tripId)
        .execute();

      return reply.send({
        statusCode: 200,
        data: { tripId, budget, currency: currency?.toUpperCase() ?? 'USD' },
      });
    },
  );

  // ─── POST /api/trips/:tripId/expenses/export ───────────────────────────

  app.post(
    '/api/trips/:tripId/expenses/export',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { format?: 'pdf' | 'csv' };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const format = request.query.format ?? 'csv';

      const expenses = await db
        .selectFrom('expenses')
        .selectAll()
        .where('user_id', '=', userId)
        .where('trip_id', '=', tripId)
        .orderBy('date', 'asc')
        .execute();

      if (format === 'csv') {
        const csv = generateCsv(expenses);
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="expenses-${tripId}.csv"`)
          .send(csv);
      }

      // PDF generation (simplified — in production use PDFKit or similar)
      const pdfContent = generatePdfPlaceholder(expenses, tripId);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="expenses-${tripId}.pdf"`)
        .send(pdfContent);
    },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateExpense(body: CreateExpenseBody): string[] {
  const errors: string[] = [];

  if (!body.amount || body.amount < 0.01 || body.amount > 999999999.99) {
    errors.push('amount must be between 0.01 and 999,999,999.99');
  }

  if (!body.currency || body.currency.length !== 3) {
    errors.push('currency must be a 3-letter ISO 4217 code');
  }

  if (!body.category || !EXPENSE_CATEGORIES.includes(body.category)) {
    errors.push(`category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}/.test(body.date)) {
    errors.push('date must be a valid ISO date (YYYY-MM-DD)');
  }

  if (body.notes && body.notes.length > 500) {
    errors.push('notes must be at most 500 characters');
  }

  return errors;
}

/**
 * Check budget thresholds and create alerts (80% and 100%).
 */
async function checkBudgetThresholds(
  db: Kysely<Database>,
  tripId: string,
  userId: string,
): Promise<void> {
  const trip = await db
    .selectFrom('trips')
    .select(['budget', 'budget_currency', 'budget_alert_80', 'budget_alert_100'])
    .where('id', '=', tripId)
    .executeTakeFirst();

  if (!trip?.budget) return;

  // Calculate total spending
  const expenses = await db
    .selectFrom('expenses')
    .select('converted_amount')
    .where('trip_id', '=', tripId)
    .where('user_id', '=', userId)
    .execute();

  const totalSpent = expenses.reduce(
    (sum, e) => sum + (e.converted_amount ?? 0),
    0,
  );

  const percentUsed = (totalSpent / trip.budget) * 100;

  // 80% threshold
  if (percentUsed >= 80 && percentUsed < 100 && !trip.budget_alert_80) {
    await db
      .updateTable('trips')
      .set({ budget_alert_80: true })
      .where('id', '=', tripId)
      .execute();
    // In production: fire push notification
    console.log(`[Budget] 80% threshold reached for trip ${tripId}`);
  } else if (percentUsed < 80 && trip.budget_alert_80) {
    // Reset if drops below
    await db
      .updateTable('trips')
      .set({ budget_alert_80: false })
      .where('id', '=', tripId)
      .execute();
  }

  // 100% threshold
  if (percentUsed >= 100 && !trip.budget_alert_100) {
    await db
      .updateTable('trips')
      .set({ budget_alert_100: true })
      .where('id', '=', tripId)
      .execute();
    console.log(`[Budget] 100% threshold exceeded for trip ${tripId}`);
  } else if (percentUsed < 100 && trip.budget_alert_100) {
    await db
      .updateTable('trips')
      .set({ budget_alert_100: false })
      .where('id', '=', tripId)
      .execute();
  }
}

function generateCsv(expenses: any[]): string {
  const header = 'Date,Merchant,Category,Amount,Currency,Converted Amount,Home Currency\n';
  const rows = expenses
    .map(
      (e) =>
        `${e.date},"${e.merchant_name ?? ''}",${e.category},${e.amount},${e.currency},${e.converted_amount ?? ''},${e.home_currency ?? 'USD'}`,
    )
    .join('\n');
  return header + rows;
}

function generatePdfPlaceholder(expenses: any[], tripId: string): string {
  // In production, use PDFKit or puppeteer to generate actual PDF
  return `%PDF-1.4\n% Expense Report for Trip ${tripId}\n% ${expenses.length} expenses\n% This is a placeholder. Use PDFKit in production.`;
}
