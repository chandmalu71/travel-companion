'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface SettlementDebt {
  from: { memberId: string; name: string; userId: string | null };
  to: { memberId: string; name: string; userId: string | null };
  amount: number;
  settlementId?: string;
  amountPaid: number;
  settled: boolean;
}

interface SettlementData {
  settlements: SettlementDebt[];
  totalSharedExpenses: number;
  currency: string;
  memberCount: number;
}

interface BalanceMember {
  memberId: string;
  userId: string | null;
  name: string;
  balance: number;
}

interface SettlementViewProps {
  tripId: string;
  currentUserId?: string;
}

export function SettlementView({ tripId, currentUserId }: SettlementViewProps) {
  const [data, setData] = useState<SettlementData | null>(null);
  const [balances, setBalances] = useState<BalanceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const loadData = () => {
    Promise.all([
      api.get<{ data: SettlementData }>(`/api/trips/${tripId}/settlements`),
      api.get<{ data: { balances: BalanceMember[]; currency: string } }>(`/api/trips/${tripId}/balances`),
    ])
      .then(([sRes, bRes]) => {
        setData(sRes.data);
        setBalances(bRes.data.balances);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [tripId]);

  const handlePay = async (debt: SettlementDebt) => {
    if (!debt.settlementId) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    setPayingId(debt.settlementId);
    try {
      await api.post(`/api/trips/${tripId}/settlements/${debt.settlementId}/pay`, {
        amount,
        notes: payNotes || undefined,
      });
      setPayAmount('');
      setPayNotes('');
      loadData();
    } catch { /* toast */ }
    finally { setPayingId(null); }
  };

  if (loading) {
    return <div className="animate-pulse space-y-3">
      <div className="h-20 bg-gray-200 rounded-lg" />
      <div className="h-16 bg-gray-200 rounded-lg" />
    </div>;
  }

  if (!data || data.settlements.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-gray-600 font-medium">All settled!</p>
        <p className="text-sm text-gray-400 mt-1">No outstanding balances for this trip.</p>
      </div>
    );
  }

  const myBalance = balances.find(b => b.userId === currentUserId);

  return (
    <div className="space-y-4">
      {/* Your balance card */}
      {myBalance && (
        <div className={`rounded-lg p-4 border ${myBalance.balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Your Balance</p>
          <p className={`text-2xl font-bold ${myBalance.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {myBalance.balance >= 0 ? '+' : ''}{data.currency} {myBalance.balance.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {myBalance.balance > 0 ? 'Others owe you this amount' : myBalance.balance < 0 ? 'You owe this amount to others' : 'You are all squared up'}
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white border border-gray-200 p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{data.currency} {data.totalSharedExpenses.toFixed(0)}</p>
          <p className="text-[10px] text-gray-500">Total Shared</p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{data.memberCount}</p>
          <p className="text-[10px] text-gray-500">Members</p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{data.settlements.filter(s => !s.settled).length}</p>
          <p className="text-[10px] text-gray-500">Pending</p>
        </div>
      </div>

      {/* Settlement list (simplified debts) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">Settlements</p>
          <button onClick={() => setShowDetail(!showDetail)} className="text-xs text-primary-600 hover:underline">
            {showDetail ? 'Hide details' : 'Show details'}
          </button>
        </div>

        <div className="space-y-2">
          {data.settlements.map((debt, i) => {
            const remaining = debt.amount - debt.amountPaid;
            const progress = debt.amount > 0 ? (debt.amountPaid / debt.amount) * 100 : 0;

            return (
              <div key={i} className={`rounded-lg border p-3 ${debt.settled ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      <span className="font-medium text-gray-900">{debt.from.name}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="font-medium text-gray-900">{debt.to.name}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${debt.settled ? 'text-green-600 line-through' : 'text-gray-900'}`}>
                      {data.currency} {debt.amount.toFixed(2)}
                    </p>
                    {debt.settled && <span className="text-[10px] text-green-600 font-medium">✓ Settled</span>}
                  </div>
                </div>

                {/* Progress bar for partial payments */}
                {!debt.settled && debt.amountPaid > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>Paid: {data.currency} {debt.amountPaid.toFixed(2)}</span>
                      <span>Remaining: {data.currency} {remaining.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Pay action (for non-settled debts) */}
                {!debt.settled && debt.settlementId && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {payingId === debt.settlementId ? (
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.01" min="0.01" max={remaining} placeholder={remaining.toFixed(2)}
                          value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-xs" autoFocus />
                        <input type="text" placeholder="Note (optional)" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs" />
                        <button onClick={() => handlePay(debt)} className="rounded bg-primary-600 px-2 py-1 text-xs text-white font-medium hover:bg-primary-500">Pay</button>
                        <button onClick={() => setPayingId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setPayingId(debt.settlementId!); setPayAmount(remaining.toFixed(2)); }}
                          className="text-xs text-primary-600 font-medium hover:underline">
                          💰 Mark as paid ({data.currency} {remaining.toFixed(2)})
                        </button>
                        <button onClick={() => { setPayingId(debt.settlementId!); setPayAmount(''); }}
                          className="text-xs text-gray-400 hover:text-gray-600">
                          Partial payment
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail view — all member balances */}
      {showDetail && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">All Member Balances</p>
          <div className="space-y-2">
            {balances.map(member => (
              <div key={member.memberId} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">{member.name}</span>
                <span className={`text-sm font-semibold ${member.balance > 0 ? 'text-green-600' : member.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {member.balance > 0 ? '+' : ''}{data.currency} {member.balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200 text-[10px] text-gray-400">
            Positive = owed to you · Negative = you owe · Net zero = settled
          </div>
        </div>
      )}
    </div>
  );
}
