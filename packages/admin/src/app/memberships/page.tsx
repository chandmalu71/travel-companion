'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export default function MembershipsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/trip-memberships')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-20 bg-gray-800 rounded-lg" /><div className="h-40 bg-gray-800 rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Trip Memberships</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-400">Total Travellers</p>
          <p className="text-2xl font-bold text-white">{stats?.totalTravellers ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-400">Active Members</p>
          <p className="text-2xl font-bold text-green-400">{stats?.activeTravellers ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-400">Pending Invitations</p>
          <p className="text-2xl font-bold text-amber-400">{stats?.pendingInvitations ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-400">Avg Members/Trip</p>
          <p className="text-2xl font-bold text-blue-400">{stats?.avgPerTrip ?? 0}</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm font-semibold text-white mb-3">By Traveller Type</p>
          <div className="space-y-2">
            {stats?.byType?.map((t: any) => (
              <div key={t.type} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{t.type === 'adult' ? '👤' : t.type === 'child' ? '👦' : '👶'} {t.type}</span>
                <span className="text-sm font-medium text-white">{t.count}</span>
              </div>
            )) ?? <p className="text-gray-500 text-sm">No data</p>}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm font-semibold text-white mb-3">By Role</p>
          <div className="space-y-2">
            {stats?.byRole?.map((r: any) => (
              <div key={r.role} className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{r.role}</span>
                <span className="text-sm font-medium text-white">{r.count}</span>
              </div>
            )) ?? <p className="text-gray-500 text-sm">No data</p>}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <p className="text-sm font-semibold text-white mb-3">Groups ({stats?.totalGroups ?? 0})</p>
        <div className="space-y-2">
          {stats?.groups?.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color || '#6B7280' }} />
                <span className="text-gray-300">{g.name}</span>
                <span className="text-gray-500 text-xs">({g.group_type})</span>
              </div>
              <span className="text-white">{g.member_count} members</span>
            </div>
          )) ?? <p className="text-gray-500 text-sm">No groups</p>}
        </div>
      </div>
    </div>
  );
}
