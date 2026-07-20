'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DocumentPreview } from '@/components/document-preview';

interface SourceAttachment {
  id: string;
  sourceType: string;
  mimeType?: string;
  createdAt?: string;
}

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
  sourceAttachment: SourceAttachment | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  food_dining: '🍕',
  transportation: '🚗',
  accommodation: '🏨',
  tours_activities: '🎭',
  shopping: '🛍️',
  entertainment: '🎬',
  other: '📦',
};

const RECEIPT_ICONS: Record<string, string> = {
  receipt_scan: '📷',
  pdf: '📄',
  email: '📧',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; sourceType: string; mimeType?: string } | null>(null);
  const [attachingExpenseId, setAttachingExpenseId] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data?: Expense[]; statusCode?: number }>('/api/expenses')
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.converted_amount) || Number(e.amount) || 0), 0);

  const handleAttachReceipt = async (expenseId: string) => {
    setAttachingExpenseId(expenseId);
    try {
      const res = await api.post<{ data: { id: string } }>(`/api/expenses/${expenseId}/receipt`, {
        mimeType: 'image/jpeg',
        fileName: 'receipt.jpg',
      });
      // Update the expense in state with the new attachment
      setExpenses(prev => prev.map(e =>
        e.id === expenseId ? { ...e, sourceAttachment: { id: res.data.id, sourceType: 'receipt_scan', mimeType: 'image/jpeg' } } : e
      ));
    } catch {
      // In production, show error toast
    } finally {
      setAttachingExpenseId(null);
    }
  };

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
              className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-200 transition-all"
            >
              <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[expense.category] ?? '📦'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {expense.merchant_name ?? expense.category.replace('_', ' ')}
                  </p>
                  <span className="text-[11px] text-gray-400">{expense.date}</span>
                </div>
                {expense.notes && <p className="text-[11px] text-gray-400 truncate">{expense.notes}</p>}
              </div>

              {/* Receipt attachment indicator */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {expense.sourceAttachment ? (
                  <button
                    onClick={() => setPreviewAttachment(expense.sourceAttachment!)}
                    className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                    title="View receipt"
                  >
                    {RECEIPT_ICONS[expense.sourceAttachment.sourceType] ?? '📎'}
                    <span>Receipt</span>
                    <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => handleAttachReceipt(expense.id)}
                    disabled={attachingExpenseId === expense.id}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                    title="Attach receipt"
                  >
                    {attachingExpenseId === expense.id ? '⏳' : '📎'}
                    <span>Add receipt</span>
                  </button>
                )}
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-semibold text-gray-900 text-sm">
                  {expense.currency} {Number(expense.amount).toFixed(2)}
                </p>
                {expense.converted_amount && expense.currency !== 'USD' && (
                  <p className="text-[10px] text-gray-400">≈ ${Number(expense.converted_amount).toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scan receipt modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowScanModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Scan Receipt</h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload a photo of your receipt to automatically extract expense details using AI.
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 hover:border-primary-300 transition-colors cursor-pointer">
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm text-gray-600">Drag & drop or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, HEIC, PDF — max 10MB</p>
              <input type="file" accept="image/jpeg,image/png,image/heic,application/pdf" className="hidden" />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowScanModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
                Upload & Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document preview slide-over */}
      {previewAttachment && (
        <DocumentPreview
          attachmentId={previewAttachment.id}
          sourceType={previewAttachment.sourceType}
          mimeType={previewAttachment.mimeType}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
