'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  budget_currency: string | null;
}

type StatusFilter = 'all' | 'upcoming' | 'active' | 'completed' | 'planning';

function getTripStatus(trip: Trip): { status: StatusFilter; label: string; color: string; icon: string } {
  if (!trip.start_date) return { status: 'planning', label: 'Planning', color: 'bg-gray-100 text-gray-600', icon: '📝' };
  const now = new Date();
  const start = new Date(trip.start_date);
  const end = trip.end_date ? new Date(trip.end_date) : start;
  if (now < start) return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-700', icon: '📅' };
  if (now >= start && now <= end) return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-700', icon: '✈️' };
  return { status: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-500', icon: '✅' };
}

function getCountdown(trip: Trip): string {
  if (!trip.start_date) return '';
  const now = new Date();
  const start = new Date(trip.start_date);
  const end = trip.end_date ? new Date(trip.end_date) : start;
  if (now > end) return '';
  if (now >= start && now <= end) return '🟢 Active now';
  const days = Math.ceil((start.getTime() - now.getTime()) / 86400000);
  if (days === 0) return '🔥 Today!';
  if (days === 1) return '⏰ Tomorrow';
  if (days <= 7) return `⏳ In ${days} days`;
  if (days <= 30) return `📅 In ${Math.ceil(days / 7)} weeks`;
  return `📅 In ${Math.ceil(days / 30)} months`;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  useEffect(() => {
    api.get<{ data?: Trip[]; trips?: Trip[] }>('/api/trips')
      .then((res) => setTrips(res.data ?? res.trips ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Stats
  const stats = {
    upcoming: trips.filter(t => getTripStatus(t).status === 'upcoming').length,
    active: trips.filter(t => getTripStatus(t).status === 'active').length,
    completed: trips.filter(t => getTripStatus(t).status === 'completed').length,
    planning: trips.filter(t => getTripStatus(t).status === 'planning').length,
  };

  // Filter & search
  let filtered = trips;
  if (filter !== 'all') filtered = filtered.filter(t => getTripStatus(t).status === filter);
  if (search) filtered = filtered.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
    return bDate - aDate;
  });

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <Link href="/trips/new" className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
          + New Trip
        </Link>
      </div>

      {/* Quick stats */}
      {trips.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {([
            { key: 'upcoming', label: 'Upcoming', icon: '📅', count: stats.upcoming },
            { key: 'active', label: 'Active', icon: '✈️', count: stats.active },
            { key: 'completed', label: 'Completed', icon: '✅', count: stats.completed },
            { key: 'planning', label: 'Planning', icon: '📝', count: stats.planning },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
              className={`rounded-lg border p-3 text-center transition-all ${filter === s.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <p className="text-lg font-bold text-gray-900">{s.count}</p>
              <p className="text-[11px] text-gray-500">{s.icon} {s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + Sort */}
      {trips.length > 0 && (
        <div className="flex gap-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search trips..." className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="date">Sort by date</option>
            <option value="name">Sort by name</option>
          </select>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
              Clear filter ✕
            </button>
          )}
        </div>
      )}

      {/* Trip cards */}
      {filtered.length === 0 && trips.length > 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No trips match your filter.</p>
          <button onClick={() => { setFilter('all'); setSearch(''); }} className="mt-2 text-sm text-primary-600 hover:underline">Show all trips</button>
        </div>
      )}

      {trips.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-4xl mb-3">✈️</p>
          <p className="text-lg text-gray-500">No trips yet</p>
          <p className="mt-2 text-sm text-gray-400">Create your first trip to start planning!</p>
          <Link href="/trips/new" className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500">
            Create Trip
          </Link>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(trip => {
            const { status, label, color, icon } = getTripStatus(trip);
            const countdown = getCountdown(trip);

            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all h-full">
                  {/* Status + countdown */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
                      {icon} {label}
                    </span>
                    {countdown && <span className="text-[10px] text-gray-500">{countdown}</span>}
                  </div>

                  {/* Trip name */}
                  <h3 className="font-semibold text-gray-900 text-lg">{trip.name}</h3>

                  {/* Dates */}
                  <p className="mt-1 text-xs text-gray-400">
                    {trip.start_date
                      ? `${new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${trip.end_date ? new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open'}`
                      : 'No dates set'}
                  </p>

                  {/* Budget progress */}
                  {trip.budget && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Budget</span>
                        <span>{trip.budget_currency ?? '€'}{Number(trip.budget).toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: '35%' }} />
                      </div>
                    </div>
                  )}

                  {/* Bottom row: members + bookings indicators */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <div className="flex -space-x-1.5">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-5 w-5 rounded-full bg-primary-100 border border-white flex items-center justify-center">
                          <span className="text-[8px] text-primary-600 font-bold">{String.fromCharCode(64 + i)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>✈️ 2</span>
                      <span>🏨 1</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
