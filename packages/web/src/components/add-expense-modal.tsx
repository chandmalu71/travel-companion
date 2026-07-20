'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: 'food_dining', label: 'Food & Dining', icon: '🍕' },
  { value: 'transportation', label: 'Transportation', icon: '🚗' },
  { value: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { value: 'tours_activities', label: 'Tours & Activities', icon: '🎭' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '📦' },
];
const CURRENCIES_FALLBACK = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'INR', 'SGD', 'THB', 'IDR', 'MXN', 'BRL'];

interface Props { onClose: () => void; onCreated: () => void; tripId?: string; }

export function AddExpenseModal({ onClose, onCreated, tripId: initialTripId }: Props) {
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
  const [includedMembers, setIncludedMembers] = useState<Record<string, boolean>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [itemAmounts, setItemAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currencies, setCurrencies] = useState<Array<{ code: string; symbol: string }>>([]);

  // Fetch enabled currencies from API
  useEffect(() => {
    api.get<{ data: Array<{ code: string; symbol: string }> }>('/api/i18n/currencies')
      .then(r => { if (r.data?.length) setCurrencies(r.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (!initialTripId) { api.get<{ data?: any[]; trips?: any[] }>('/api/trips').then(r => setTrips(r.data ?? r.trips ?? [])).catch(() => {}); } }, [initialTripId]);

  useEffect(() => {
    const tid = selectedTripId || initialTripId;
    if (tid) {
      api.get<{ data: Array<{ id: string; name: string }> }>(`/api/trips/${tid}/members`)
        .then(r => { const m = r.data ?? []; setTripMembers(m); setIncludedMembers(Object.fromEntries(m.map(x => [x.id, true]))); })
        .catch(() => setTripMembers([]));
    } else { setTripMembers([]); }
  }, [selectedTripId, initialTripId]);

  const amt = parseFloat(amount) || 0;
  const includedCount = Object.values(includedMembers).filter(Boolean).length;
  const equalShare = includedCount > 0 ? (amt / includedCount).toFixed(2) : '0.00';
  const activeTripId = selectedTripId || initialTripId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (isShared && splitType === 'percentage') {
      const t = Object.entries(percentages).filter(([id]) => includedMembers[id]).reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
      if (Math.abs(t - 100) > 0.01) { setError(`Percentages must sum to 100%`); return; }
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: { id: string } }>('/api/expenses', { amount: amt, currency, category, date, merchantName: merchantName || undefined, notes: notes || undefined, isShared, tripId: activeTripId || undefined });
      if (isShared && res.data?.id && activeTripId) {
        const list = tripMembers.filter(m => includedMembers[m.id]);
        if (list.length > 0) {
          const members = list.map(m => ({ memberId: m.id, ...(splitType === 'equal' ? { amount: amt / list.length } : splitType === 'percentage' ? { percentage: parseFloat(percentages[m.id] ?? '0') } : { amount: parseFloat(itemAmounts[m.id] ?? '0') }) }));
          await api.post(`/api/trips/${activeTripId}/expenses/${res.data.id}/split`, { splitType, members }).catch(() => {});
        }
      }
      onCreated();
    } catch { setError('Failed to create expense.'); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{initialTripId ? 'Add Expense to Trip' : 'Add Expense'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button type="button" onClick={() => setIsShared(true)} className={`flex-1 py-2.5 text-sm font-medium ${isShared ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>👥 Shared</button>
            <button type="button" onClick={() => setIsShared(false)} className={`flex-1 py-2.5 text-sm font-medium ${!isShared ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🔒 Personal</button>
          </div>
          {!initialTripId && <div><label className="block text-xs font-medium text-gray-700 mb-1">Trip</label><select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="">No trip</option>{trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs font-medium text-gray-700 mb-1">Amount</label><input type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" autoFocus /></div>
            <div className="w-24"><label className="block text-xs font-medium text-gray-700 mb-1">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm">{(currencies.length > 0 ? currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : CURRENCIES_FALLBACK.map(c => <option key={c}>{c}</option>))}</select></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <div className="grid grid-cols-4 gap-1.5">{CATEGORIES.map(cat => (<button key={cat.value} type="button" onClick={() => setCategory(cat.value)} className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[10px] ${category === cat.value ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600'}`}><span className="text-base">{cat.icon}</span><span className="truncate w-full text-center">{cat.label.split(' ')[0]}</span></button>))}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Merchant</label><input type="text" placeholder="e.g. Starbucks" value={merchantName} onChange={e => setMerchantName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label><input type="text" placeholder="Optional" value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
          {isShared && tripMembers.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
              <p className="text-xs font-semibold text-gray-700 uppercase">Split</p>
              <div className="flex gap-1">{(['equal','percentage','per_item'] as const).map(t => (<button key={t} type="button" onClick={() => setSplitType(t)} className={`flex-1 py-1.5 text-xs rounded-md ${splitType === t ? 'bg-white border border-primary-300 text-primary-700 shadow-sm' : 'text-gray-500'}`}>{t === 'equal' ? '÷ Equal' : t === 'percentage' ? '% Pct' : '🏷️ Item'}</button>))}</div>
              {tripMembers.map(m => (<div key={m.id} className="flex items-center gap-2"><input type="checkbox" checked={includedMembers[m.id] ?? false} onChange={e => setIncludedMembers(p => ({...p,[m.id]:e.target.checked}))} className="rounded border-gray-300 text-primary-600" /><span className="text-sm flex-1">{m.name}</span>{splitType === 'equal' && includedMembers[m.id] && <span className="text-xs text-gray-500">{currency} {equalShare}</span>}{splitType === 'percentage' && includedMembers[m.id] && <input type="number" step="0.1" placeholder="%" value={percentages[m.id]??''} onChange={e => setPercentages(p=>({...p,[m.id]:e.target.value}))} className="w-14 rounded border px-1 py-0.5 text-xs text-right" />}{splitType === 'per_item' && includedMembers[m.id] && <input type="number" step="0.01" placeholder="0" value={itemAmounts[m.id]??''} onChange={e => setItemAmounts(p=>({...p,[m.id]:e.target.value}))} className="w-16 rounded border px-1 py-0.5 text-xs text-right" />}</div>))}
            </div>
          )}
          {isShared && !activeTripId && <p className="text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-200">⚠️ Select a trip to configure split</p>}
          {!isShared && <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 border border-gray-200">🔒 Only visible to you</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
