'use client';

import { useState } from 'react';

interface QueueItem {
  id: string;
  from: string;
  subject: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
}

const MOCK_QUEUE: QueueItem[] = [
  { id: '1', from: 'user@gmail.com', subject: 'Booking Confirmation - Delta DL1234', status: 'completed', receivedAt: '2026-07-19 12:00', processedAt: '2026-07-19 12:01', error: null },
  { id: '2', from: 'noreply@booking.com', subject: 'Your reservation at Hotel Roma', status: 'processing', receivedAt: '2026-07-19 13:00', processedAt: null, error: null },
  { id: '3', from: 'bad@spam.com', subject: 'Buy crypto now!!!', status: 'failed', receivedAt: '2026-07-19 13:30', processedAt: '2026-07-19 13:30', error: 'Not a booking email' },
];

export default function EmailQueuePage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'failed'>('all');

  const filtered = MOCK_QUEUE.filter((item) => filter === 'all' || item.status === filter);

  const counts = {
    pending: MOCK_QUEUE.filter((i) => i.status === 'pending').length,
    processing: MOCK_QUEUE.filter((i) => i.status === 'processing').length,
    completed: MOCK_QUEUE.filter((i) => i.status === 'completed').length,
    failed: MOCK_QUEUE.filter((i) => i.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Email Processing Queue</h1>

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatusCard label="Pending" count={counts.pending} color="amber" />
        <StatusCard label="Processing" count={counts.processing} color="blue" />
        <StatusCard label="Completed" count={counts.completed} color="green" />
        <StatusCard label="Failed" count={counts.failed} color="red" />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'pending', 'processing', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Queue table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 text-gray-300 text-xs">{item.from}</td>
                <td className="px-4 py-3 text-gray-200 text-xs max-w-xs truncate">{item.subject}</td>
                <td className="px-4 py-3"><QueueBadge status={item.status} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{item.receivedAt}</td>
                <td className="px-4 py-3 text-red-400 text-xs">{item.error ?? '—'}</td>
                <td className="px-4 py-3">
                  {item.status === 'failed' && (
                    <button className="text-xs bg-amber-700/30 text-amber-300 px-2 py-1 rounded hover:bg-amber-700/50">
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-700/50',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-700/50',
    green: 'text-green-400 bg-green-500/10 border-green-700/50',
    red: 'text-red-400 bg-red-500/10 border-red-700/50',
  };
  return (
    <div className={`rounded-lg p-4 border ${colors[color]}`}>
      <p className={`text-2xl font-bold ${colors[color]?.split(' ')[0]}`}>{count}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function QueueBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}
