'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface TripDetail {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
  budget: number | null;
  budget_currency: string | null;
}

interface Booking {
  id: string;
  type: 'flight' | 'hotel' | 'car_rental';
  status: string;
  checked_in: boolean;
}

type TabId = 'overview' | 'timeline' | 'map' | 'expenses' | 'documents';

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<TripDetail & { data?: TripDetail }>(`/api/trips/${tripId}`),
      api.get<{ data?: Booking[]; bookings?: Booking[] }>(`/api/bookings?tripId=${tripId}`),
    ])
      .then(([tripRes, bookingsRes]) => {
        // API may return trip directly or wrapped in .data
        const tripData = (tripRes as any).data ?? tripRes;
        setTrip(tripData?.id ? tripData : null);
        setBookings(bookingsRes.data ?? bookingsRes.bookings ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />;
  }

  if (!trip) {
    return <div className="text-center text-gray-500 py-12">Trip not found</div>;
  }

  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'map', label: 'Map', icon: '🗺️' },
    { id: 'expenses', label: 'Expenses', icon: '💰' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  return (
    <div className="space-y-6">
      {/* Trip header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
          {trip.destination && (
            <p className="text-sm text-gray-500 mt-1">📍 {trip.destination}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
            Share
          </button>
          <button className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500">
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Trip sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab trip={trip} bookings={bookings} />}
      {activeTab === 'timeline' && <TimelineTab tripId={tripId} />}
      {activeTab === 'map' && <MapTab tripId={tripId} />}
      {activeTab === 'expenses' && <ExpensesTab tripId={tripId} />}
      {activeTab === 'documents' && <DocumentsTab tripId={tripId} />}
    </div>
  );
}

function OverviewTab({ trip, bookings }: { trip: TripDetail; bookings: Booking[] }) {
  const flights = bookings.filter((b) => b.type === 'flight');
  const hotels = bookings.filter((b) => b.type === 'hotel');
  const cars = bookings.filter((b) => b.type === 'car_rental');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Booking summary */}
      <div className="rounded-lg bg-white p-6 border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Bookings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">✈️ Flights</span>
            <span className="text-sm font-medium">{flights.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">🏨 Hotels</span>
            <span className="text-sm font-medium">{hotels.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">🚗 Car Rentals</span>
            <span className="text-sm font-medium">{cars.length}</span>
          </div>
        </div>
      </div>

      {/* Budget summary */}
      <div className="rounded-lg bg-white p-6 border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Budget</h3>
        {trip.budget ? (
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {trip.budget_currency ?? '$'}{trip.budget.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total budget</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No budget set</p>
        )}
      </div>

      {/* Gap alerts placeholder */}
      <div className="rounded-lg bg-white p-6 border border-gray-200 shadow-sm lg:col-span-2">
        <h3 className="font-semibold text-gray-900 mb-4">Planning Alerts</h3>
        <p className="text-sm text-gray-500">No alerts at this time.</p>
      </div>
    </div>
  );
}

function TimelineTab({ tripId }: { tripId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: any[] }>(`/api/trips/${tripId}/timeline`)
      .then((res) => setEvents(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Timeline</h3>
        <button className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">
          + Add Event
        </button>
      </div>
      {events.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No timeline events yet. Add bookings or custom events to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event: any, i: number) => (
            <div key={i} className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
              <p className="font-medium text-gray-900">{event.title ?? 'Event'}</p>
              <p className="text-sm text-gray-500">{event.date ?? ''} {event.time ?? ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapTab({ tripId }: { tripId: string }) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-96 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-2">🗺️</p>
          <p className="text-gray-500 text-sm">
            Map view requires Google Maps SDK.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Configure NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab({ tripId }: { tripId: string }) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: any }>(`/api/trips/${tripId}/expenses/summary`)
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Expenses</h3>
        <div className="flex gap-2">
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">
            Export CSV
          </button>
          <button className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">
            + Add Expense
          </button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Total Spent</p>
            <p className="text-xl font-bold">${summary.grandTotal?.toFixed(2) ?? '0.00'}</p>
          </div>
          <div className="rounded-lg bg-white p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Expenses</p>
            <p className="text-xl font-bold">{summary.expenseCount ?? 0}</p>
          </div>
          <div className="rounded-lg bg-white p-4 border border-gray-200">
            <p className="text-sm text-gray-500">Budget Used</p>
            <p className="text-xl font-bold">{summary.budgetUsedPercent ?? 0}%</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No expenses recorded yet.</p>
      )}
    </div>
  );
}

function DocumentsTab({ tripId }: { tripId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Documents</h3>
        <button className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">
          + Upload
        </button>
      </div>
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">Drop files here or click Upload to add documents.</p>
        <p className="text-xs text-gray-400 mt-1">Supports PDF, JPEG, PNG, HEIC (max 25MB)</p>
      </div>
    </div>
  );
}
