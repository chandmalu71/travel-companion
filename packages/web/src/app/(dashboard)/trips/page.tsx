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

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data?: Trip[]; trips?: Trip[] }>('/api/trips')
      .then((res) => setTrips(res.data ?? res.trips ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <Link
          href="/trips/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
        >
          + New Trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-lg text-gray-500">No trips yet</p>
          <p className="mt-2 text-sm text-gray-400">Create your first trip to start planning!</p>
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
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all">
                <h3 className="font-semibold text-gray-900">{trip.name}</h3>
                {trip.destination && (
                  <p className="mt-1 text-sm text-gray-500">📍 {trip.destination}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {trip.start_date
                    ? `${new Date(trip.start_date).toLocaleDateString()} — ${trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'Open'}`
                    : 'No dates set'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
