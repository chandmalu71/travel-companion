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
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">+ Create User</button>
      </div>

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

      {/* Create User Modal */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const handleCreate = async () => {
    setError('');
    if (!email || !displayName || !password) { setError('All fields are required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, password, role: role || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.message ?? 'User created');
      } else {
        setError(data.error ?? 'Failed to create user');
      }
    } catch { setError('Network error'); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Create New User</h3>

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-green-400">✅ {result}</p>
            <button onClick={onClose} className="w-full rounded-md bg-gray-700 py-2 text-sm text-white">Close</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Display Name *</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm">
                <option value="">Regular User (no admin access)</option>
                <option value="super-admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="support">Support</option>
                <option value="ops">Ops</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        )}
      </div>
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
