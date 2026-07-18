'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  converted_amount: number | null;
  category: string;
  date: string;
  merchant_name: string | null;
  notes: string | null;
  trip_id: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  food_drink: '🍕',
  transport: '🚗',
  accommodation: '🏨',
  activities: '🎭',
  shopping: '🛍️',
  health: '💊',
  other: '📦',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    api.get<{ data: Expense[] }>('/api/expenses')
      .then((res) => setExpenses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = expenses.reduce((sum, e) => sum + (e.converted_amount ?? e.amount), 0);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            📷 Scan Receipt
          </button>
          <button className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-white p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-3xl font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
          </div>
          <p className="text-sm text-gray-500">{expenses.length} expenses</p>
        </div>
      </div>

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No expenses yet. Add your first expense or scan a receipt.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 border border-gray-200 shadow-sm hover:border-primary-200"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{CATEGORY_ICONS[expense.category] ?? '📦'}</span>
                <div>
                  <p className="font-medium text-gray-900">
                    {expense.merchant_name ?? expense.category.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">{expense.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {expense.currency} {expense.amount.toFixed(2)}
                </p>
                {expense.converted_amount && expense.currency !== 'USD' && (
                  <p className="text-xs text-gray-500">≈ ${expense.converted_amount.toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scan modal placeholder */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold mb-4">Scan Receipt</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload a photo of your receipt to automatically extract expense details.
            </p>
            <input type="file" accept="image/jpeg,image/png,image/heic" className="mb-4" />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowScanModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white">
                Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
