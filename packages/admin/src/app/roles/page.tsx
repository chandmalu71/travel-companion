'use client';

import { useEffect, useState } from 'react';

interface AdminUser { id: string; email: string; display_name: string; admin_role: string | null; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  return res.json();
}

const ROLE_COLORS: Record<string, string> = {
  'super-admin': 'bg-red-900/50 text-red-300 border-red-700',
  'admin': 'bg-amber-900/50 text-amber-300 border-amber-700',
  'support': 'bg-blue-900/50 text-blue-300 border-blue-700',
  'ops': 'bg-green-900/50 text-green-300 border-green-700',
};

const ROLE_LABELS: Record<string, string> = {
  'super-admin': '🔴 Super Admin',
  'admin': '🟠 Admin',
  'support': '🔵 Support',
  'ops': '🟢 Ops',
};

export default function RolesPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);

  const loadAdmins = () => {
    apiFetch('/api/admin/roles').then(r => setAdmins(r.data ?? []));
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleSearch = async () => {
    if (searchEmail.length < 3) return;
    setSearching(true);
    const r = await apiFetch('/api/admin/roles/search', { method: 'POST', body: JSON.stringify({ email: searchEmail }) });
    setSearchResults(r.data ?? []);
    setSearching(false);
  };

  const handleSetRole = async (userId: string, role: string | null) => {
    await apiFetch(`/api/admin/roles/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });
    loadAdmins();
    setSearchResults([]);
    setSearchEmail('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Role Management</h1>
        <span className="text-sm text-gray-400">{admins.length} admin users</span>
      </div>

      {/* Current admin users */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-300">User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Email</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Role</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {admins.map(user => (
              <tr key={user.id} className="hover:bg-gray-700">
                <td className="px-4 py-3 text-white font-medium">{user.display_name}</td>
                <td className="px-4 py-3 text-gray-400">{user.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.admin_role ?? ''] ?? 'bg-gray-800 text-gray-400 border-gray-600'}`}>
                    {ROLE_LABELS[user.admin_role ?? ''] ?? user.admin_role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={user.admin_role ?? ''}
                    onChange={e => handleSetRole(user.id, e.target.value || null)}
                    className="rounded border border-gray-600 bg-gray-700 text-white px-2 py-1 text-xs"
                  >
                    <option value="super-admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="support">Support</option>
                    <option value="ops">Ops</option>
                    <option value="">Remove Role</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new admin */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Add Admin User</h3>
        <div className="flex gap-2">
          <input type="text" placeholder="Search by email..." value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
          <button onClick={handleSearch} disabled={searching || searchEmail.length < 3}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(user => (
              <div key={user.id} className="flex items-center justify-between rounded-md border border-gray-600 bg-gray-700 px-3 py-2">
                <div>
                  <span className="text-sm text-white">{user.display_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{user.email}</span>
                  {user.admin_role && <span className="text-xs text-amber-400 ml-2">(currently: {user.admin_role})</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleSetRole(user.id, 'admin')} className="rounded bg-amber-600 px-2 py-1 text-xs text-white">Admin</button>
                  <button onClick={() => handleSetRole(user.id, 'support')} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">Support</button>
                  <button onClick={() => handleSetRole(user.id, 'ops')} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Ops</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
