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
  destination?: string | null;
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
                <div className="rounded-lg bg-white shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all h-full overflow-hidden">
                  {/* Header image */}
                  <div className="h-32 bg-gray-200 relative overflow-hidden">
                    <img
                      src={getTripHeaderImage(trip.name, trip.destination)}
                      alt={trip.destination ?? trip.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {trip.destination && (
                      <p className="absolute bottom-2 left-3 text-white text-xs font-medium drop-shadow-sm">
                        📍 {trip.destination}
                      </p>
                    )}
                  </div>

                  <div className="p-4">
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
                  </div>{/* end p-4 */}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── Trip Header Image Helper ────────────────────────────────────────────────

const DESTINATION_IMAGES: Record<string, string> = {
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&q=80',
  spain: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=600&q=80',
  japan: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
  kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
  greece: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&q=80',
  santorini: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80',
  mykonos: 'https://images.unsplash.com/photo-1601581875039-e899893d520c?w=600&q=80',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80',
  nyc: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  france: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  rome: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80',
  italy: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600&q=80',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
  finland: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80',
  lapland: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80',
  rovaniemi: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80',
  thailand: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=80',
  india: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
  australia: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=600&q=80',
  iceland: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=600&q=80',
  maldives: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80',
  morocco: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80',
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80';

function getTripHeaderImage(name: string, destination?: string | null): string {
  const searchText = (destination ?? name).toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (searchText.includes(key)) return url;
  }
  return FALLBACK_IMAGE;
}
