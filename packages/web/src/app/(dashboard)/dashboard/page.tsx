'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Trip[] }>('/api/trips')
      .then((res) => setTrips(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/trips/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
        >
          + New Trip
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Trips" value={trips.filter(t => t.start_date).length.toString()} icon="✈️" />
        <StatCard title="Upcoming" value={trips.filter(t => t.start_date && new Date(t.start_date) > new Date()).length.toString()} icon="📅" />
        <StatCard title="Total Trips" value={trips.length.toString()} icon="🌍" />
        <StatCard title="This Month" value="0" icon="📊" />
      </div>

      {/* Trip list */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Trips</h2>
        {trips.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">No trips yet. Create your first trip to get started!</p>
            <Link
              href="/trips/new"
              className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
            >
              Create Trip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const formatDate = (d: string | null) => {
    if (!d) return 'No date';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all">
        <h3 className="font-semibold text-gray-900">{trip.name}</h3>
        {trip.destination && (
          <p className="mt-1 text-sm text-gray-500">📍 {trip.destination}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
        </p>
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-40 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
