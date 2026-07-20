'use client';

import { useEffect, useState } from 'react';

interface Trip {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  booking_count: number;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/api/admin/trips')
      .then(r => setTrips(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? trips.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.owner_email.toLowerCase().includes(search.toLowerCase()) ||
        t.owner_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.destination ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : trips;

  if (loading) return <div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-800 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">All Trips</h1>
        <span className="text-sm text-gray-400">{trips.length} total</span>
      </div>

      {/* Search */}
      <input type="text" placeholder="Search trips, owners, destinations..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md rounded-md border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm" />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-center">
          <p className="text-lg font-bold text-white">{trips.length}</p>
          <p className="text-[10px] text-gray-400">Total Trips</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-center">
          <p className="text-lg font-bold text-green-400">{trips.filter(t => t.start_date && new Date(t.start_date) > new Date()).length}</p>
          <p className="text-[10px] text-gray-400">Upcoming</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{trips.reduce((s, t) => s + t.member_count, 0)}</p>
          <p className="text-[10px] text-gray-400">Total Members</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{trips.reduce((s, t) => s + t.booking_count, 0)}</p>
          <p className="text-[10px] text-gray-400">Total Bookings</p>
        </div>
      </div>

      {/* Trips table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Trip</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Dates</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Members</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Bookings</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map(trip => (
              <tr key={trip.id} className="hover:bg-gray-700">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{trip.name}</p>
                  {trip.destination && <p className="text-[10px] text-gray-400">{trip.destination}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-300 text-xs">{trip.owner_name}</p>
                  <p className="text-[10px] text-gray-500">{trip.owner_email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {trip.start_date ? `${trip.start_date.slice(0, 10)} → ${trip.end_date?.slice(0, 10) ?? '?'}` : '—'}
                </td>
                <td className="px-4 py-3 text-center text-white">{trip.member_count}</td>
                <td className="px-4 py-3 text-center text-white">{trip.booking_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(trip.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No trips found.</p>}
      </div>
    </div>
  );
}
