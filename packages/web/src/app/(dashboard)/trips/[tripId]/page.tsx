'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SourceIndicator } from '@/components/source-indicator';
import { QuickActions } from '@/components/quick-actions';
import { SettlementView } from '@/components/settlement-view';
import { AddExpenseModal } from '@/components/add-expense-modal';

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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data?: any[] }>(`/api/trips/${tripId}/timeline-enriched`)
      .then((res) => setItems(res.data ?? []))
      .catch(() => {
        // Fallback to basic bookings if enriched fails
        api.get<{ data?: any[]; bookings?: any[] }>(`/api/bookings?tripId=${tripId}`)
          .then((res) => setItems(res.data ?? res.bookings ?? []))
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Timeline</h3>
        <button className="rounded-md bg-primary-500 px-3 py-1.5 text-xs text-white hover:bg-primary-600">
          + Add Event
        </button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No bookings yet. Add flights, hotels, or car rentals to build your timeline.</p>
        </div>
      ) : (
        <div className="relative pl-8 space-y-4">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

          {items.map((item: any, i: number) => (
            <div key={item.id ?? i} className="relative">
              <div className={`absolute -left-5 top-4 w-4 h-4 rounded-full border-2 border-white shadow ${
                item.status === 'completed' ? 'bg-gray-400' :
                item.status === 'active' ? 'bg-accent-500' : 'bg-primary-500'
              }`} />

              {item.type === 'flight' && <FlightCard item={item} />}
              {item.type === 'hotel' && <HotelCard item={item} />}
              {item.type === 'car_rental' && <CarRentalCard item={item} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlightCard({ item }: { item: any }) {
  const dep = item.departureTime ? new Date(item.departureTime) : null;
  const arr = item.arrivalTime ? new Date(item.arrivalTime) : null;
  const leaveBy = item.leaveHomeBy ? new Date(item.leaveHomeBy) : null;
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const durationHrs = item.flightDurationMinutes ? Math.floor(item.flightDurationMinutes / 60) : 0;
  const durationMin = item.flightDurationMinutes ? item.flightDurationMinutes % 60 : 0;
  const names = item.travellerNames?.length > 0 ? (item.travellerNames.length > 3 ? `${item.travellerNames.slice(0, 2).join(', ')} +${item.travellerNames.length - 2}` : item.travellerNames.join(', ')) : null;

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm ml-2 relative overflow-hidden">
      {item.countdown && item.status === 'upcoming' && (
        <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-md">{item.countdown}</div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">✈️</span>
          <p className="font-semibold text-gray-900 text-sm">{item.airline ?? 'Flight'} {item.flightNumber ?? ''} <span className="text-gray-400 font-normal">·</span> <span className="text-gray-500 font-normal">{item.departureAirport} → {item.arrivalAirport}</span></p>
        </div>
        <StatusBadge status={item.status} checkedIn={item.checkedIn} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600 mb-2">
        {item.confirmationNumber && <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0">PNR: {item.confirmationNumber}</span>}
        {item.seat && <span>💺 {item.seat}</span>}
        {item.terminal && <span>🏢 {item.terminal}{item.gate ? `/${item.gate}` : ''}</span>}
        {item.cabinClass && <span>{item.cabinClass}</span>}
        {item.baggageAllowance && <span>🧳 {item.baggageAllowance}</span>}
        {names && <span className="text-gray-400">· 👤 {names}</span>}
      </div>
      {dep && (
        <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-lg p-2.5 mb-2">
          <div><p className="text-[10px] text-gray-500">Departure</p><p className="text-sm font-semibold text-gray-900">{formatTime(dep)}</p><p className="text-[10px] text-gray-400">{formatDate(dep)}</p></div>
          <div><p className="text-[10px] text-gray-500">Duration</p><p className="text-sm font-semibold text-gray-900">{durationHrs}h {durationMin}m</p><p className="text-[10px] text-gray-400">✈️ ─ ─ →</p></div>
          <div><p className="text-[10px] text-gray-500">Arrival</p><p className="text-sm font-semibold text-gray-900">{arr ? formatTime(arr) : '—'}</p><p className="text-[10px] text-gray-400">{arr ? formatDate(arr) : ''}</p></div>
        </div>
      )}
      {(leaveBy || item.checkinOpens) && (
        <div className="flex gap-3 text-[11px] text-gray-500 mb-1">
          {leaveBy && <span>🏠 Leave by <strong className="text-gray-700">{formatTime(leaveBy)}</strong></span>}
          {item.checkinOpens && <span>📱 Check-in <strong className="text-gray-700">{new Date(item.checkinOpens).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {formatTime(new Date(item.checkinOpens))}</strong></span>}
        </div>
      )}
      {item.notes && <p className="text-[11px] text-gray-500 italic bg-yellow-50 rounded px-2 py-0.5 border border-yellow-100 mb-1">📝 {item.notes}</p>}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <SourceIndicator source={item.source} sourceAttachment={item.sourceAttachment} bookingId={item.id} className="mt-0 pt-0 border-0" />
        <QuickActions address={item.departureAirport ? `${item.departureAirport} Airport` : undefined} className="mt-0 pt-0 border-0" />
      </div>
    </div>
  );
}

function HotelCard({ item }: { item: any }) {
  const names = item.travellerNames?.length > 0 ? (item.travellerNames.length > 3 ? `${item.travellerNames.slice(0, 2).join(', ')} +${item.travellerNames.length - 2}` : item.travellerNames.join(', ')) : null;

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm ml-2 relative overflow-hidden">
      {item.countdown && item.status === 'upcoming' && (
        <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-md">{item.countdown}</div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏨</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{item.hotelName ?? 'Hotel'}</p>
            {item.address && <p className="text-[11px] text-gray-400">{item.address}</p>}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600 mb-2">
        {item.confirmationNumber && <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0">Ref: {item.confirmationNumber}</span>}
        {item.roomType && <span>🛏️ {item.roomType}</span>}
        {item.numberOfGuests && <span>👥 {item.numberOfGuests}{names ? ` (${names})` : ''}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-lg p-2.5 mb-2">
        <div><p className="text-[10px] text-gray-500">Check-in</p><p className="text-sm font-semibold text-gray-900">{item.checkinDate ?? '—'}</p><p className="text-[10px] text-gray-400">{item.checkinTime ?? '15:00'}</p></div>
        <div><p className="text-[10px] text-gray-500">Nights</p><p className="text-lg font-bold text-gray-900">{item.numberOfNights ?? '—'}</p><p className="text-[10px] text-gray-400">🌙</p></div>
        <div><p className="text-[10px] text-gray-500">Check-out</p><p className="text-sm font-semibold text-gray-900">{item.checkoutDate ?? '—'}</p><p className="text-[10px] text-gray-400">{item.checkoutTime ?? '11:00'}</p></div>
      </div>
      {item.notes && <p className="text-[11px] text-gray-500 italic bg-yellow-50 rounded px-2 py-0.5 border border-yellow-100 mb-1">📝 {item.notes}</p>}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <SourceIndicator source={item.source} sourceAttachment={item.sourceAttachment} bookingId={item.id} className="mt-0 pt-0 border-0" />
        <QuickActions address={item.address} latitude={item.latitude} longitude={item.longitude} phone={item.contactPhone} className="mt-0 pt-0 border-0" />
      </div>
    </div>
  );
}

function CarRentalCard({ item }: { item: any }) {
  const pickup = item.pickupTime ? new Date(item.pickupTime) : null;
  const returnTime = item.returnTime ? new Date(item.returnTime) : null;
  const formatDateTime = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const names = item.travellerNames?.length > 0 ? item.travellerNames.join(', ') : null;

  return (
    <div className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm ml-2 relative overflow-hidden">
      {item.countdown && item.status === 'upcoming' && (
        <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-md">{item.countdown}</div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚗</span>
          <p className="font-semibold text-gray-900 text-sm">{item.company ?? 'Car Rental'} {item.vehicleClass ? <span className="text-gray-400 font-normal">·</span> : ''} <span className="font-normal text-gray-500 text-xs">{item.vehicleClass ?? ''}</span></p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600 mb-2">
        {item.confirmationNumber && <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0">Ref: {item.confirmationNumber}</span>}
        {names && <span>🪪 {names}</span>}
        {item.insurance && <span>🛡️ {item.insurance}</span>}
        {item.fuelPolicy && <span>⛽ {item.fuelPolicy}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center bg-gray-50 rounded-lg p-2.5 mb-2">
        <div><p className="text-[10px] text-gray-500">Pickup</p><p className="text-sm font-semibold text-gray-900">{pickup ? formatDateTime(pickup) : '—'}</p></div>
        <div><p className="text-[10px] text-gray-500">Duration</p><p className="text-lg font-bold text-gray-900">{item.rentalDays ?? '—'}</p><p className="text-[10px] text-gray-400">days</p></div>
        <div><p className="text-[10px] text-gray-500">Return</p><p className="text-sm font-semibold text-gray-900">{returnTime ? formatDateTime(returnTime) : '—'}</p></div>
      </div>
      {item.pickupLocation && (
        <p className="text-[11px] text-gray-500 mb-1">📍 {item.pickupLocation}{item.returnLocation && item.returnLocation !== item.pickupLocation ? ` → ${item.returnLocation}` : ''}</p>
      )}
      {item.extras && item.extras.length > 0 && <p className="text-[11px] text-gray-400 mb-1">➕ {item.extras.join(', ')}</p>}
      {item.notes && <p className="text-[11px] text-gray-500 italic bg-yellow-50 rounded px-2 py-0.5 border border-yellow-100 mb-1">📝 {item.notes}</p>}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <SourceIndicator source={item.source} sourceAttachment={item.sourceAttachment} bookingId={item.id} className="mt-0 pt-0 border-0" />
        <QuickActions address={item.pickupLocation} latitude={item.pickupLatitude} longitude={item.pickupLongitude} className="mt-0 pt-0 border-0" />
      </div>
    </div>
  );
}

function StatusBadge({ status, checkedIn }: { status: string; checkedIn?: boolean }) {
  if (checkedIn) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Checked In</span>;
  const styles: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700',
    active: 'bg-amber-100 text-amber-700',
    completed: 'bg-gray-100 text-gray-500',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ''}`}>{status}</span>;
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
  const [subTab, setSubTab] = useState<'expenses' | 'settlements'>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);

  const loadSummary = () => {
    api.get<{ data: any }>(`/api/trips/${tripId}/expenses/summary`)
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); }, [tripId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setSubTab('expenses')}
            className={`px-4 py-1.5 text-xs font-medium transition-all ${subTab === 'expenses' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            💰 Expenses
          </button>
          <button onClick={() => setSubTab('settlements')}
            className={`px-4 py-1.5 text-xs font-medium transition-all ${subTab === 'settlements' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            🤝 Settlements
          </button>
        </div>
        {subTab === 'expenses' && (
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">Export CSV</button>
            <button onClick={() => setShowAddExpense(true)} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">+ Add Expense</button>
          </div>
        )}
      </div>

      {subTab === 'expenses' ? (
        <>
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
        </>
      ) : (
        <SettlementView tripId={tripId} />
      )}

      {/* Add Expense Modal (trip context) */}
      {showAddExpense && (
        <AddExpenseModal
          tripId={tripId}
          onClose={() => setShowAddExpense(false)}
          onCreated={() => { setShowAddExpense(false); loadSummary(); }}
        />
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
