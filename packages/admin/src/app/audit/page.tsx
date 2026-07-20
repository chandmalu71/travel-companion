'use client';

import { useState } from 'react';

interface AuditEntry {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  target: string;
  details: string;
  ip: string;
}

const MOCK_ENTRIES: AuditEntry[] = [
  { id: '1', timestamp: '2026-07-19 13:45:00', admin: 'admin@nayya.ai', action: 'user_suspended', target: 'spam@test.com', details: 'Misuse: 200+ email scans/day', ip: '192.168.1.1' },
  { id: '2', timestamp: '2026-07-19 12:30:00', admin: 'admin@nayya.ai', action: 'config_changed', target: 'feature_flags', details: 'Disabled social_sharing', ip: '192.168.1.1' },
  { id: '3', timestamp: '2026-07-19 10:15:00', admin: 'admin@nayya.ai', action: 'model_changed', target: 'email_parsing.tier1', details: 'Changed to amazon.nova-lite-v1:0', ip: '192.168.1.1' },
];

const ACTION_TYPES = ['All', 'user_suspended', 'user_reactivated', 'user_deleted', 'config_changed', 'model_changed', 'announcement_sent', 'impersonation'];

const ACTION_ICONS: Record<string, string> = {
  user_suspended: '🚫',
  user_reactivated: '✅',
  user_deleted: '🗑️',
  config_changed: '⚙️',
  model_changed: '🤖',
  announcement_sent: '📢',
  impersonation: '👁️',
};

export default function AuditPage() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = MOCK_ENTRIES.filter((e) =>
    (filter === 'All' || e.action === filter) &&
    (search === '' || e.admin.includes(search) || e.target.includes(search) || e.details.includes(search))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Audit Log</h1>
      <p className="text-sm text-gray-400">All admin actions are logged with timestamps, IP addresses, and details.</p>

        {/* Filters */}
        <div className="flex gap-4">
          <input type="text" placeholder="Search admin, target, or details..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white">
            {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>

        {/* Audit table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-lg">{ACTION_ICONS[entry.action] ?? '📝'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{entry.timestamp}</td>
                  <td className="px-4 py-3 text-gray-300">{entry.admin}</td>
                  <td className="px-4 py-3"><ActionBadge action={entry.action} /></td>
                  <td className="px-4 py-3 text-gray-300">{entry.target}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{entry.details}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{entry.ip}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No audit entries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    user_suspended: 'bg-red-500/20 text-red-400',
    user_deleted: 'bg-red-500/20 text-red-400',
    user_reactivated: 'bg-green-500/20 text-green-400',
    config_changed: 'bg-blue-500/20 text-blue-400',
    model_changed: 'bg-purple-500/20 text-purple-400',
    announcement_sent: 'bg-amber-500/20 text-amber-400',
    impersonation: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[action] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}


