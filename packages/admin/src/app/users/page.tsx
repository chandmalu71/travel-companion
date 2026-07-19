'use client';

import { useState } from 'react';

interface User {
  id: string;
  email: string;
  displayName: string;
  registeredAt: string;
  lastLogin: string;
  status: 'active' | 'suspended' | 'deleted';
  tripsCount: number;
  emailsConnected: number;
}

const MOCK_USERS: User[] = [
  { id: '1', email: 'test@example.com', displayName: 'Test User', registeredAt: '2026-07-18', lastLogin: '2026-07-19', status: 'active', tripsCount: 3, emailsConnected: 1 },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <span className="text-xl">🧭</span>
          <p className="font-bold text-white text-sm">Nayya Admin</p>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">User Management</h1>

        {/* Search + Filter */}
        <div className="flex gap-4 mb-6">
          <input
            type="text" placeholder="Search by email or name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white">
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* User Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trips</th>
                <th className="px-4 py-3">Emails</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map((user) => (
                <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.displayName}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">{user.tripsCount}</td>
                  <td className="px-4 py-3 text-gray-300">{user.emailsConnected}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{user.lastLogin}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600">View</button>
                      <button className="text-xs bg-amber-700/30 text-amber-300 px-2 py-1 rounded hover:bg-amber-700/50">Suspend</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    suspended: 'bg-red-500/20 text-red-400',
    deleted: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}
