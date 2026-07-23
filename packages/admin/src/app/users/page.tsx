'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const APP_URL = API_BASE.replace('api-', '').replace('api.', '');

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  suspended: boolean;
  suspended_reason: string | null;
  admin_role: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('status', filter);
      params.set('limit', String(pageSize));
      params.set('offset', String(offset));

      const res = await fetch(`${API_BASE}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.data) setUsers(data.data);
      if (data.pagination) setTotal(data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  }, [token, search, filter, pageSize, offset]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset offset when search/filter/pageSize changes
  useEffect(() => {
    setOffset(0);
  }, [search, filter, pageSize]);

  const handleSuspend = async (userId: string) => {
    if (!token) return;
    const reason = prompt('Suspension reason (optional):');
    await fetch(`${API_BASE}/api/admin/users/${userId}/suspend`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    fetchUsers();
  };

  const handleReactivate = async (userId: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/admin/users/${userId}/reactivate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  const handleImpersonate = async (email: string) => {
    if (!token) return;
    setImpersonating(email);
    try {
      const res = await fetch(`${API_BASE}/api/admin/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.data?.accessToken) {
        // Open the main app in a new tab with the impersonated session
        const url = `${APP_URL}?impersonate_token=${encodeURIComponent(data.data.accessToken)}`;
        window.open(url, '_blank');
      } else {
        alert(data.error || 'Failed to impersonate');
      }
    } catch {
      alert('Impersonation failed');
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{users.length} users</span>
          <button onClick={() => setShowCreate(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Create User
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-lg bg-gray-800 border border-gray-600 px-3 py-2 text-sm text-white"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* User Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">
                          {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{user.display_name}</p>
                        <p className="text-gray-400 text-xs truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge suspended={user.suspended} verified={user.email_verified} />
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionBadge plan={user.subscription_plan} status={user.subscription_status} />
                  </td>
                  <td className="px-4 py-3">
                    {user.admin_role ? (
                      <span className="inline-flex items-center rounded-full bg-purple-500/20 text-purple-400 px-2 py-0.5 text-xs font-medium">
                        {user.admin_role}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleImpersonate(user.email)}
                        disabled={impersonating === user.email}
                        className="text-xs bg-blue-700/30 text-blue-300 px-2 py-1 rounded hover:bg-blue-700/50 disabled:opacity-50"
                        title="Log in as this user"
                      >
                        {impersonating === user.email ? '...' : 'Impersonate'}
                      </button>
                      {user.suspended ? (
                        <button
                          onClick={() => handleReactivate(user.id)}
                          className="text-xs bg-green-700/30 text-green-300 px-2 py-1 rounded hover:bg-green-700/50"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(user.id)}
                          className="text-xs bg-amber-700/30 text-amber-300 px-2 py-1 rounded hover:bg-amber-700/50"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg bg-gray-800 border border-gray-600 px-2 py-1 text-sm text-white"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-500">
            Showing {offset + 1}-{Math.min(offset + pageSize, total)} of {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            disabled={offset === 0}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-30 hover:bg-gray-600"
          >
            Previous
          </button>
          <button
            onClick={() => setOffset(offset + pageSize)}
            disabled={offset + pageSize >= total}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm text-white disabled:opacity-30 hover:bg-gray-600"
          >
            Next
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && <CreateUserModal onClose={() => { setShowCreate(false); fetchUsers(); }} token={token} />}
    </div>
  );
}

function StatusBadge({ suspended, verified }: { suspended: boolean; verified: boolean }) {
  if (suspended) {
    return <span className="inline-flex items-center rounded-full bg-red-500/20 text-red-400 px-2 py-0.5 text-xs font-medium">suspended</span>;
  }
  if (!verified) {
    return <span className="inline-flex items-center rounded-full bg-yellow-500/20 text-yellow-400 px-2 py-0.5 text-xs font-medium">unverified</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-green-500/20 text-green-400 px-2 py-0.5 text-xs font-medium">active</span>;
}

function SubscriptionBadge({ plan, status }: { plan?: string | null; status?: string | null }) {
  if (!plan || plan === 'free') {
    return <span className="text-gray-500 text-xs">Free</span>;
  }
  const colors: Record<string, string> = {
    pro: 'bg-blue-500/20 text-blue-400',
    premium: 'bg-amber-500/20 text-amber-400',
  };
  const statusLabel = status === 'trialing' ? ' (trial)' : status === 'cancelled' ? ' (cancelled)' : '';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[plan] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {plan}{statusLabel}
    </span>
  );
}

function CreateUserModal({ onClose, token }: { onClose: () => void; token: string | null }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    if (!email || !displayName || !password) { setError('All fields are required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            <p className="text-sm text-green-400">{result}</p>
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
                <option value="">Regular User</option>
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
