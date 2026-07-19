'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EmailConnectPrompt } from './email-connect-prompt';

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
}

interface EmailConnection {
  id: string;
  provider: string;
  email: string;
  isActive: boolean;
  lastScanStatus: string;
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data?: Trip[]; trips?: Trip[] }>('/api/trips')
        .then((res) => setTrips(res.data ?? res.trips ?? []))
        .catch(() => {}),
      api.get<{ data?: { connections: EmailConnection[] } }>('/api/email/connections')
        .then((res) => setConnections(res.data?.connections ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Post-login email connection prompt (shows once) */}
      <EmailConnectPrompt loginProvider={null} />

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

      {/* Connected accounts indicator */}
      <ConnectedAccountsBar connections={connections} />

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

function ConnectedAccountsBar({ connections }: { connections: EmailConnection[] }) {
  const PROVIDER_INFO: Record<string, { icon: string; name: string }> = {
    gmail: { icon: '📧', name: 'Gmail' },
    outlook: { icon: '📬', name: 'Outlook' },
    yahoo: { icon: '💜', name: 'Yahoo' },
    imap: { icon: '⚙️', name: 'IMAP' },
    icloud: { icon: '☁️', name: 'iCloud' },
  };

  if (connections.length === 0) return null;

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Connected Emails:</span>
          <div className="flex items-center gap-2">
            {connections.map((conn) => {
              const info = PROVIDER_INFO[conn.provider] ?? { icon: '📧', name: conn.provider };
              return (
                <span
                  key={conn.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    conn.isActive
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                  title={`${conn.email} — ${conn.isActive ? 'Active' : 'Disconnected'}${conn.lastScanStatus === 'error' ? ' (scan error)' : ''}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    conn.isActive
                      ? conn.lastScanStatus === 'error' ? 'bg-amber-400' : 'bg-green-400'
                      : 'bg-gray-300'
                  }`} />
                  {info.icon} {info.name}
                </span>
              );
            })}
          </div>
        </div>
        <Link
          href="/settings/email-connections"
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          Manage
        </Link>
      </div>
    </div>
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
