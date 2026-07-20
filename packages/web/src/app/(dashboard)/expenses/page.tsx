'use client';

import { useEffect, useState, useRef } from 'react';
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
  is_shared: boolean;
  tripName: string | null;
  sourceAttachment: SourceAttachment | null;
  sharedWith: Array<{ memberId: string; name: string; amount: number | null; percentage: number | null; splitType: string }> | null;
}

const CATEGORIES = [
  { value: 'food_dining', label: 'Food & Dining', icon: '🍕' },
  { value: 'transportation', label: 'Transportation', icon: '🚗' },
  { value: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { value: 'tours_activities', label: 'Tours & Activities', icon: '🎭' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.icon]));

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'INR', 'SGD', 'THB', 'IDR', 'MXN', 'BRL'];

const RECEIPT_ICONS: Record<string, string> = { receipt_scan: '📷', pdf: '📄', email: '📧' };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; sourceType: string; mimeType?: string } | null>(null);
  const [attachingExpenseId, setAttachingExpenseId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [movingExpense, setMovingExpense] = useState<Expense | null>(null);

  const loadExpenses = () => {
    api.get<{ data?: Expense[]; statusCode?: number }>('/api/expenses')
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadExpenses(); }, []);

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.converted_amount) || Number(e.amount) || 0), 0);

  const receiptFileRef = useRef<HTMLInputElement>(null);
  const [receiptExpenseId, setReceiptExpenseId] = useState<string | null>(null);

  const handleAttachReceipt = (expenseId: string) => {
    setReceiptExpenseId(expenseId);
    receiptFileRef.current?.click();
  };

  const handleReceiptFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const expenseId = receiptExpenseId;
    if (!file || !expenseId) return;

    if (file.size > 10 * 1024 * 1024) { alert('File too large. Maximum 10MB.'); return; }

    setAttachingExpenseId(expenseId);
    try {
      const res = await api.post<{ data: { id: string } }>(`/api/expenses/${expenseId}/receipt`, {
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
      });
      setExpenses(prev => prev.map(ex =>
        ex.id === expenseId ? { ...ex, sourceAttachment: { id: res.data.id, sourceType: 'receipt_scan', mimeType: file.type || 'image/jpeg' } } : ex
      ));
    } catch { /* toast in production */ }
    finally {
      setAttachingExpenseId(null);
      setReceiptExpenseId(null);
      // Reset the file input so the same file can be selected again
      if (receiptFileRef.current) receiptFileRef.current.value = '';
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for receipt attachment */}
      <input ref={receiptFileRef} type="file" accept="image/jpeg,image/png,image/heic,application/pdf" className="hidden" onChange={handleReceiptFileSelected} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowScanModal(true)} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
            📷 Scan Receipt
          </button>
          <button onClick={() => setShowAddModal(true)} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
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
            <div key={expense.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-200 transition-all group">
              <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[expense.category] ?? '📦'}</span>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingExpense(expense)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm truncate">{expense.merchant_name ?? expense.category.replace('_', ' ')}</p>
                  <span className="text-[11px] text-gray-400">{expense.date}</span>
                  {expense.tripName && <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1 truncate max-w-[120px]">{expense.tripName}</span>}
                  {expense.is_shared && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">shared</span>}
                  {!expense.is_shared && <span className="text-[10px] bg-gray-50 text-gray-400 border border-gray-200 rounded px-1">personal</span>}
                </div>
                {expense.notes && <p className="text-[11px] text-gray-400 truncate">{expense.notes}</p>}
                {expense.is_shared && expense.sharedWith && expense.sharedWith.length > 0 && (
                  <p className="text-[10px] text-blue-500 truncate">
                    👥 Shared with: {expense.sharedWith.map(s => s.name).join(', ')}
                    {expense.sharedWith[0]?.splitType === 'equal' && ` (equal split)`}
                    {expense.sharedWith[0]?.splitType === 'percentage' && ` (% split)`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {expense.sourceAttachment ? (
                  <button onClick={() => setPreviewAttachment(expense.sourceAttachment!)} className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer" title="View receipt">
                    {RECEIPT_ICONS[expense.sourceAttachment.sourceType] ?? '📎'} Receipt ↗
                  </button>
                ) : (
                  <button onClick={() => handleAttachReceipt(expense.id)} disabled={attachingExpenseId === expense.id} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors" title="Attach receipt">
                    {attachingExpenseId === expense.id ? '⏳' : '📎'} Add receipt
                  </button>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-semibold text-gray-900 text-sm">{expense.currency} {Number(expense.amount).toFixed(2)}</p>
                {expense.converted_amount && expense.currency !== 'USD' && (
                  <p className="text-[10px] text-gray-400">≈ ${Number(expense.converted_amount).toFixed(2)}</p>
                )}
              </div>
              {/* Actions menu */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExpenseActions
                  expense={expense}
                  onEdit={() => setEditingExpense(expense)}
                  onDelete={() => setDeletingExpense(expense)}
                  onMoveToTrip={() => setMovingExpense(expense)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <AddExpenseModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadExpenses(); }}
        />
      )}

      {/* Scan Receipt Modal */}
      {showScanModal && (
        <ScanReceiptModal
          onClose={() => setShowScanModal(false)}
          onScanned={() => { setShowScanModal(false); loadExpenses(); }}
        />
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

      {/* Edit Expense Modal */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => { setEditingExpense(null); loadExpenses(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingExpense && (
        <DeleteExpenseConfirm
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
          onDeleted={() => { setDeletingExpense(null); loadExpenses(); }}
        />
      )}

      {/* Move to Trip */}
      {movingExpense && (
        <MoveToTripModal
          expense={movingExpense}
          onClose={() => setMovingExpense(null)}
          onMoved={() => { setMovingExpense(null); loadExpenses(); }}
        />
      )}
    </div>
  );
}

// ─── Add Expense Modal ───────────────────────────────────────────────────────

interface AddExpenseModalProps {
  onClose: () => void;
  onCreated: () => void;
  tripId?: string; // If provided, auto-selects this trip
}

function AddExpenseModal({ onClose, onCreated, tripId: initialTripId }: AddExpenseModalProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [category, setCategory] = useState('food_dining');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchantName, setMerchantName] = useState('');
  const [notes, setNotes] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'per_item'>('equal');
  const [selectedTripId, setSelectedTripId] = useState(initialTripId ?? '');
  const [trips, setTrips] = useState<Array<{ id: string; name: string }>>([]);
  const [tripMembers, setTripMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [includedMembers, setIncludedMembers] = useState<Record<string, boolean>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [itemAmounts, setItemAmounts] = useState<Record<string, string>>({});

  // Fetch user's trips (only if no initialTripId)
  useEffect(() => {
    if (!initialTripId) {
      api.get<{ data?: Array<{ id: string; name: string }>; trips?: Array<{ id: string; name: string }> }>('/api/trips')
        .then(res => setTrips(res.data ?? res.trips ?? []))
        .catch(() => {});
    }
  }, [initialTripId]);

  // Fetch trip members when trip is selected
  useEffect(() => {
    const tid = selectedTripId || initialTripId;
    if (tid) {
      api.get<{ data: Array<{ id: string; userId: string; name: string }> }>(`/api/trips/${tid}/members`)
        .then(res => {
          const members = res.data ?? [];
          setTripMembers(members);
          setIncludedMembers(Object.fromEntries(members.map(m => [m.id, true])));
          setPercentages({});
          setItemAmounts({});
        })
        .catch(() => setTripMembers([]));
    } else {
      setTripMembers([]);
    }
  }, [selectedTripId, initialTripId]);

  const amt = parseFloat(amount) || 0;
  const includedCount = Object.values(includedMembers).filter(Boolean).length;
  const equalShare = includedCount > 0 ? (amt / includedCount).toFixed(2) : '0.00';
  const activeTripId = selectedTripId || initialTripId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!amt || amt <= 0) { setError('Please enter a valid amount'); return; }
    if (!date) { setError('Please select a date'); return; }

    if (isShared && splitType === 'percentage') {
      const totalPct = Object.entries(percentages).filter(([id]) => includedMembers[id]).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) { setError(`Percentages must sum to 100% (currently ${totalPct.toFixed(1)}%)`); return; }
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ data: { id: string } }>('/api/expenses', {
        amount: amt, currency, category, date,
        merchantName: merchantName || undefined,
        notes: notes || undefined,
        isShared,
        tripId: activeTripId || undefined,
      });

      // Save split configuration for shared expenses
      if (isShared && res.data?.id && activeTripId) {
        const includedMemberList = tripMembers.filter(m => includedMembers[m.id]);
        if (includedMemberList.length > 0) {
          const splitMembers = includedMemberList.map(m => {
            const entry: { memberId: string; percentage?: number; amount?: number } = { memberId: m.id };
            if (splitType === 'percentage') entry.percentage = parseFloat(percentages[m.id] ?? '0');
            if (splitType === 'per_item') entry.amount = parseFloat(itemAmounts[m.id] ?? '0');
            if (splitType === 'equal') entry.amount = amt / includedMemberList.length;
            return entry;
          });
          await api.post(`/api/trips/${activeTripId}/expenses/${res.data.id}/split`, {
            splitType, members: splitMembers,
          }).catch(() => {});
        }
      }

      onCreated();
    } catch {
      setError('Failed to create expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Expense</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shared / Personal toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button type="button" onClick={() => setIsShared(true)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all ${isShared ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              👥 Shared Expense
            </button>
            <button type="button" onClick={() => setIsShared(false)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all ${!isShared ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              🔒 Personal
            </button>
          </div>

          {/* Trip selector (only when not in trip context) */}
          {!initialTripId && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trip</label>
              <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">No trip (general expense)</option>
                {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Amount + Currency */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" autoFocus />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[10px] transition-all ${
                    category === cat.value ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <span className="text-base">{cat.icon}</span>
                  <span className="truncate w-full text-center">{cat.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Merchant */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Merchant</label>
              <input type="text" placeholder="e.g. Starbucks" value={merchantName} onChange={(e) => setMerchantName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <input type="text" placeholder="Dinner with team" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>

          {/* Split config (shared + trip selected) */}
          {isShared && tripMembers.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Split Configuration</p>
              <div className="flex gap-1">
                {(['equal', 'percentage', 'per_item'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setSplitType(type)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${splitType === type ? 'bg-white border border-primary-300 text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {type === 'equal' ? '÷ Equal' : type === 'percentage' ? '% Percent' : '🏷️ Per Item'}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {tripMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={includedMembers[member.id] ?? false}
                      onChange={(e) => setIncludedMembers(prev => ({ ...prev, [member.id]: e.target.checked }))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-gray-700 flex-1">{member.name}</span>
                    {splitType === 'equal' && includedMembers[member.id] && <span className="text-xs text-gray-500 font-mono">{currency} {equalShare}</span>}
                    {splitType === 'percentage' && includedMembers[member.id] && (
                      <input type="number" step="0.1" min="0" max="100" placeholder="%" value={percentages[member.id] ?? ''}
                        onChange={(e) => setPercentages(prev => ({ ...prev, [member.id]: e.target.value }))}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs text-right" />
                    )}
                    {splitType === 'per_item' && includedMembers[member.id] && (
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={itemAmounts[member.id] ?? ''}
                        onChange={(e) => setItemAmounts(prev => ({ ...prev, [member.id]: e.target.value }))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-xs text-right" />
                    )}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-200">
                {splitType === 'equal' && <span>Split equally among {includedCount} = {currency} {equalShare} each</span>}
                {splitType === 'percentage' && <span>Total: {Object.entries(percentages).filter(([id]) => includedMembers[id]).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0).toFixed(1)}%</span>}
                {splitType === 'per_item' && <span>Assigned: {currency} {Object.entries(itemAmounts).filter(([id]) => includedMembers[id]).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0).toFixed(2)} of {amt.toFixed(2)}</span>}
              </div>
            </div>
          )}

          {isShared && !activeTripId && (
            <p className="text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-200">⚠️ Select a trip to configure split among trip members</p>
          )}

          {!isShared && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <span>🔒</span><span>This expense will only be visible to you.</span>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Scan Receipt Modal ──────────────────────────────────────────────────────

function ScanReceiptModal({ onClose, onScanned }: { onClose: () => void; onScanned: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ merchantName?: string; amount?: number; currency?: string; date?: string; category?: string } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large. Maximum 10MB.'); return; }
    setSelectedFile(file);
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setScanning(true);
    try {
      // In production: upload to /api/expenses/scan and get AI-extracted fields
      // For now, simulate a scan result after a brief delay
      await new Promise(r => setTimeout(r, 1500));
      setScanResult({
        merchantName: 'Scanned Merchant',
        amount: 25.50,
        currency: 'EUR',
        date: new Date().toISOString().slice(0, 10),
        category: 'food_dining',
      });
    } catch {
      alert('Scan failed. Please try again or enter manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveScanned = async () => {
    if (!scanResult) return;
    setScanning(true);
    try {
      await api.post('/api/expenses', {
        amount: scanResult.amount,
        currency: scanResult.currency ?? 'EUR',
        category: scanResult.category ?? 'other',
        date: scanResult.date ?? new Date().toISOString().slice(0, 10),
        merchantName: scanResult.merchantName,
      });
      onScanned();
    } catch {
      alert('Failed to save expense.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📷 Scan Receipt</h3>

        {!scanResult ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Upload a photo of your receipt. AI will extract the amount, merchant, and date.
            </p>

            {/* Upload area */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer mb-4"
            >
              {preview ? (
                <img src={preview} alt="Receipt preview" className="max-h-40 mx-auto rounded-md shadow-sm" />
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl">📄</span>
                  <p className="text-sm text-gray-700">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">📷</span>
                  <p className="text-sm text-gray-600">Click to select a file</p>
                  <p className="text-xs text-gray-400">JPEG, PNG, HEIC, PDF — max 10MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,application/pdf" className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleScan} disabled={!selectedFile || scanning} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
                {scanning ? 'Scanning...' : 'Upload & Scan'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">Scan complete. Review the extracted details:</p>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-sm text-green-800">Amount</span>
                <span className="font-semibold text-green-900">{scanResult.currency} {scanResult.amount?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-600">Merchant</span>
                <span className="text-sm font-medium">{scanResult.merchantName ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-600">Date</span>
                <span className="text-sm font-medium">{scanResult.date ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-sm text-gray-600">Category</span>
                <span className="text-sm font-medium">{CATEGORIES.find(c => c.value === scanResult.category)?.label ?? 'Other'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setScanResult(null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Re-scan</button>
              <button onClick={handleSaveScanned} disabled={scanning} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
                {scanning ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── Expense Actions Menu ────────────────────────────────────────────────────

function ExpenseActions({ expense, onEdit, onDelete, onMoveToTrip }: { expense: Expense; onEdit: () => void; onDelete: () => void; onMoveToTrip: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Actions">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 rounded-md border border-gray-200 bg-white shadow-lg py-1">
            <button onClick={() => { setOpen(false); onEdit(); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              ✏️ Edit
            </button>
            <button onClick={() => { setOpen(false); onMoveToTrip(); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              📂 Move to trip
            </button>
            <button onClick={() => { setOpen(false); onDelete(); }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
              🗑️ Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Edit Expense Modal ──────────────────────────────────────────────────────

function EditExpenseModal({ expense, onClose, onSaved }: { expense: Expense; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(Number(expense.amount)));
  const [currency, setCurrency] = useState(expense.currency);
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date?.slice(0, 10) ?? '');
  const [merchantName, setMerchantName] = useState(expense.merchant_name ?? '');
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [isShared, setIsShared] = useState(expense.is_shared ?? false);
  const [selectedTripId, setSelectedTripId] = useState(expense.trip_id ?? '');
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'per_item'>((expense.sharedWith?.[0]?.splitType as any) ?? 'equal');
  const [trips, setTrips] = useState<Array<{ id: string; name: string }>>([]);
  const [tripMembers, setTripMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [includedMembers, setIncludedMembers] = useState<Record<string, boolean>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [itemAmounts, setItemAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch trips
  useEffect(() => {
    api.get<{ data?: any[]; trips?: any[] }>('/api/trips').then(r => setTrips(r.data ?? r.trips ?? [])).catch(() => {});
  }, []);

  // Fetch trip members when trip changes
  useEffect(() => {
    if (selectedTripId) {
      api.get<{ data: Array<{ id: string; name: string }> }>(`/api/trips/${selectedTripId}/members`)
        .then(r => {
          const members = r.data ?? [];
          setTripMembers(members);
          // Pre-select from existing sharedWith or all
          if (expense.sharedWith && expense.sharedWith.length > 0) {
            const inc: Record<string, boolean> = {};
            members.forEach(m => { inc[m.id] = expense.sharedWith!.some(s => s.memberId === m.id); });
            setIncludedMembers(inc);
            const pcts: Record<string, string> = {};
            const amts: Record<string, string> = {};
            expense.sharedWith.forEach(s => { if (s.percentage) pcts[s.memberId] = String(s.percentage); if (s.amount) amts[s.memberId] = String(s.amount); });
            setPercentages(pcts);
            setItemAmounts(amts);
          } else {
            setIncludedMembers(Object.fromEntries(members.map(m => [m.id, true])));
          }
        })
        .catch(() => setTripMembers([]));
    } else { setTripMembers([]); }
  }, [selectedTripId]);

  const amt = parseFloat(amount) || 0;
  const includedCount = Object.values(includedMembers).filter(Boolean).length;
  const equalShare = includedCount > 0 ? (amt / includedCount).toFixed(2) : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (isShared && splitType === 'percentage') {
      const t = Object.entries(percentages).filter(([id]) => includedMembers[id]).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(t - 100) > 0.01) { setError(`Percentages must sum to 100%`); return; }
    }
    setSubmitting(true);
    try {
      await api.put(`/api/expenses/${expense.id}`, { amount: amt, currency, category, date, merchantName: merchantName || undefined, notes: notes || undefined, isShared, tripId: selectedTripId || null });
      if (isShared && selectedTripId) {
        const list = tripMembers.filter(m => includedMembers[m.id]);
        if (list.length > 0) {
          const members = list.map(m => ({ memberId: m.id, ...(splitType === 'equal' ? { amount: amt / list.length } : splitType === 'percentage' ? { percentage: parseFloat(percentages[m.id] ?? '0') } : { amount: parseFloat(itemAmounts[m.id] ?? '0') }) }));
          await api.post(`/api/trips/${selectedTripId}/expenses/${expense.id}/split`, { splitType, members }).catch(() => {});
        }
      }
      onSaved();
    } catch { setError('Failed to update expense.'); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Expense</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button type="button" onClick={() => setIsShared(true)} className={`flex-1 py-2 text-sm font-medium ${isShared ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>👥 Shared</button>
            <button type="button" onClick={() => setIsShared(false)} className={`flex-1 py-2 text-sm font-medium ${!isShared ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🔒 Personal</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Trip</label>
            <select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">No trip</option>
              {trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs font-medium text-gray-700 mb-1">Amount</label><input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" autoFocus /></div>
            <div className="w-24"><label className="block text-xs font-medium text-gray-700 mb-1">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <div className="grid grid-cols-4 gap-1.5">{CATEGORIES.map(cat => (<button key={cat.value} type="button" onClick={() => setCategory(cat.value)} className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[10px] ${category === cat.value ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600'}`}><span className="text-base">{cat.icon}</span><span className="truncate w-full text-center">{cat.label.split(' ')[0]}</span></button>))}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Merchant</label><input type="text" value={merchantName} onChange={e => setMerchantName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          {isShared && tripMembers.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 uppercase">Split</p>
              <div className="flex gap-1">{(['equal','percentage','per_item'] as const).map(t => (<button key={t} type="button" onClick={() => setSplitType(t)} className={`flex-1 py-1.5 text-xs rounded-md ${splitType === t ? 'bg-white border border-primary-300 text-primary-700 shadow-sm' : 'text-gray-500'}`}>{t === 'equal' ? '÷ Equal' : t === 'percentage' ? '% Pct' : '🏷️ Item'}</button>))}</div>
              {tripMembers.map(m => (<div key={m.id} className="flex items-center gap-2"><input type="checkbox" checked={includedMembers[m.id] ?? false} onChange={e => setIncludedMembers(p => ({...p,[m.id]:e.target.checked}))} className="rounded border-gray-300 text-primary-600" /><span className="text-sm flex-1">{m.name}</span>{splitType === 'equal' && includedMembers[m.id] && <span className="text-xs text-gray-500">{currency} {equalShare}</span>}{splitType === 'percentage' && includedMembers[m.id] && <input type="number" step="0.1" placeholder="%" value={percentages[m.id]??''} onChange={e => setPercentages(p=>({...p,[m.id]:e.target.value}))} className="w-14 rounded border px-1 py-0.5 text-xs text-right" />}{splitType === 'per_item' && includedMembers[m.id] && <input type="number" step="0.01" placeholder="0" value={itemAmounts[m.id]??''} onChange={e => setItemAmounts(p=>({...p,[m.id]:e.target.value}))} className="w-16 rounded border px-1 py-0.5 text-xs text-right" />}</div>))}
            </div>
          )}
          {isShared && !selectedTripId && <p className="text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-200">⚠️ Select a trip to configure split</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─── Delete Expense Confirmation ─────────────────────────────────────────────

function DeleteExpenseConfirm({ expense, onClose, onDeleted }: { expense: Expense; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/expenses/${expense.id}`);
      onDeleted();
    } catch {
      alert('Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <span className="text-4xl">🗑️</span>
          <h3 className="text-lg font-semibold text-gray-900 mt-3">Delete Expense?</h3>
          <p className="text-sm text-gray-500 mt-2">
            Delete <strong>{expense.merchant_name ?? expense.category}</strong> — {expense.currency} {Number(expense.amount).toFixed(2)}?
          </p>
          <p className="text-xs text-gray-400 mt-1">This action cannot be undone. Split balances will be recalculated.</p>
        </div>
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Move to Trip Modal ──────────────────────────────────────────────────────

function MoveToTripModal({ expense, onClose, onMoved }: { expense: Expense; onClose: () => void; onMoved: () => void }) {
  const [trips, setTrips] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTripId, setSelectedTripId] = useState(expense.trip_id ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data?: Array<{ id: string; name: string }>; trips?: Array<{ id: string; name: string }> }>('/api/trips')
      .then(res => setTrips(res.data ?? res.trips ?? []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/expenses/${expense.id}`, {
        tripId: selectedTripId || null,
      });
      onMoved();
    } catch {
      alert('Failed to move expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📂 Move to Trip</h3>
        <p className="text-sm text-gray-500 mb-4">
          Assign <strong>{expense.merchant_name ?? expense.category}</strong> ({expense.currency} {Number(expense.amount).toFixed(2)}) to a trip.
        </p>

        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-3 rounded-md border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="radio" name="trip" value="" checked={selectedTripId === ''} onChange={() => setSelectedTripId('')} className="text-primary-600" />
            <span className="text-sm text-gray-500">No trip (unassigned)</span>
          </label>
          {trips.map(trip => (
            <label key={trip.id} className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${selectedTripId === trip.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="trip" value={trip.id} checked={selectedTripId === trip.id} onChange={() => setSelectedTripId(trip.id)} className="text-primary-600" />
              <span className="text-sm text-gray-900">{trip.name}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
            {saving ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
