'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { SourceIndicator } from '@/components/source-indicator';
import { QuickActions } from '@/components/quick-actions';
import { SettlementView } from '@/components/settlement-view';
import { AddExpenseModal } from '@/components/add-expense-modal';
import { useUserCurrency } from '@/hooks/use-user-currency';
import { useTranslation } from '@/i18n';

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

type TabId = 'overview' | 'timeline' | 'map' | 'expenses' | 'members' | 'documents';

const CATEGORY_ICONS: Record<string, string> = {
  food_dining: '🍕', transportation: '🚗', accommodation: '🏨',
  tours_activities: '🎭', shopping: '🛍️', entertainment: '🎬', other: '📦',
};

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
    { id: 'members', label: 'Members', icon: '👥' },
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
      {activeTab === 'members' && <MembersTab tripId={tripId} />}
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
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'expenses' | 'settlements'>('expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const { primaryCurrency, convert } = useUserCurrency();
  const { formatCurrency } = useTranslation();

  const loadExpenses = () => {
    api.get<{ data?: any[]; statusCode?: number }>(`/api/expenses?tripId=${tripId}`)
      .then((res) => setExpenses(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadExpenses(); }, [tripId]);

  const totalSpent = expenses.reduce((sum, e) => {
    const amount = Number(e.amount) || 0;
    return sum + convert(amount, e.currency ?? 'USD');
  }, 0);

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
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-4 border border-gray-200">
              <p className="text-xs text-gray-500">Total Spent</p>
              <p className="text-xl font-bold">{formatCurrency(totalSpent, primaryCurrency)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 border border-gray-200">
              <p className="text-xs text-gray-500">Expenses</p>
              <p className="text-xl font-bold">{expenses.length}</p>
            </div>
            <div className="rounded-lg bg-white p-4 border border-gray-200">
              <p className="text-xs text-gray-500">Shared / Personal</p>
              <p className="text-xl font-bold">{expenses.filter(e => e.is_shared).length} / {expenses.filter(e => !e.is_shared).length}</p>
            </div>
          </div>

          {/* Expense list */}
          {expenses.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No expenses for this trip yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense: any) => (
                <div key={expense.id} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm">
                  <span className="text-lg flex-shrink-0">{CATEGORY_ICONS[expense.category] ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{expense.merchant_name ?? expense.category?.replace('_', ' ')}</p>
                      <span className="text-[11px] text-gray-400">{expense.date?.slice(0, 10)}</span>
                      {expense.is_shared && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">shared</span>}
                    </div>
                    {expense.notes && <p className="text-[11px] text-gray-400 truncate">{expense.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">{formatCurrency(Number(expense.amount), expense.currency)}</p>
                    {expense.currency !== primaryCurrency && (
                      <p className="text-[10px] text-gray-400">≈ {formatCurrency(convert(Number(expense.amount), expense.currency), primaryCurrency)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
          onCreated={() => { setShowAddExpense(false); loadExpenses(); }}
        />
      )}
    </div>
  );
}


function MembersTab({ tripId }: { tripId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState('adult');
  const [newGroupId, setNewGroupId] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Array<{ id: string; firstName: string; lastName: string | null; relationship: string; allergies: string[]; dietaryPreferences: string[] }>>([]);
  const [addingFamily, setAddingFamily] = useState(false);

  const loadInvitations = () => {
    api.get<{ data: any[] }>(`/api/trips/${tripId}/invitations`).then(r => setInvitations(r.data ?? [])).catch(() => {});
  };

  const resendInvitation = async (id: string) => {
    await api.post(`/api/trips/${tripId}/invitations/${id}/resend`, {});
    loadInvitations();
  };

  const cancelInvitation = async (id: string) => {
    await api.delete(`/api/trips/${tripId}/invitations/${id}`);
    loadInvitations();
  };

  const loadMembers = () => {
    api.get<{ data: any }>(`/api/trips/${tripId}/travellers`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); loadInvitations(); }, [tripId]);

  const handleAddTraveller = async () => {
    if (!newName.trim()) return;
    await api.post(`/api/trips/${tripId}/travellers`, {
      displayName: newName, email: newEmail || undefined, travellerType: newType, groupId: newGroupId || undefined,
    });
    setNewName(''); setNewEmail(''); setNewType('adult'); setShowAddForm(false);
    loadMembers();
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await api.post(`/api/trips/${tripId}/travel-groups`, { name: newGroupName });
    setNewGroupName(''); setShowGroupForm(false);
    loadMembers();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this traveller from the trip?')) return;
    await api.delete(`/api/trips/${tripId}/travellers/${id}`);
    loadMembers();
  };

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />;

  const typeIcon = (t: string) => t === 'infant' ? '👶' : t === 'child' ? '👦' : '👤';
  const roleColor = (r: string) => r === 'owner' ? 'text-amber-600' : r === 'editor' ? 'text-blue-600' : 'text-gray-400';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Members ({data?.totalCount ?? 0})</h3>
        <div className="flex gap-2">
          <button onClick={() => { setShowFamilyPicker(true); api.get<{ data: any[] }>('/api/family-members/for-trip').then(r => setFamilyMembers(r.data ?? [])).catch(() => {}); }} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">👨‍👩‍👧 Family</button>
          <button onClick={() => setShowInviteForm(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">✉️ Invite</button>
          <button onClick={() => setShowGroupForm(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">+ Group</button>
          <button onClick={() => setShowAddForm(true)} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">+ Add Member</button>
        </div>
      </div>

      {/* Groups */}
      {data?.groups?.map((group: any) => (
        <div key={group.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color || '#6B7280' }} />
              <span className="font-medium text-sm text-gray-900">{group.name}</span>
              <span className="text-[10px] text-gray-400">{group.group_type} · {group.expense_split_mode}</span>
            </div>
            <span className="text-xs text-gray-400">{group.travellers?.length ?? 0} members</span>
          </div>
          <div className="divide-y divide-gray-100">
            {group.travellers?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span>{typeIcon(t.traveller_type)}</span>
                  <span className="text-sm font-medium text-gray-900">{t.display_name}</span>
                  {t.email && <span className="text-[10px] text-gray-400">{t.email}</span>}
                  {t.user_id && <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 rounded px-1">account</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${roleColor(t.role)}`}>{t.role}</span>
                  <button onClick={() => handleRemove(t.id)} className="text-[10px] text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped */}
      {data?.ungrouped?.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="font-medium text-sm text-gray-500">Ungrouped</span>
          </div>
          <div className="divide-y divide-gray-100">
            {data.ungrouped.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span>{typeIcon(t.traveller_type)}</span>
                  <span className="text-sm font-medium text-gray-900">{t.display_name}</span>
                  {t.email && <span className="text-[10px] text-gray-400">{t.email}</span>}
                  {t.user_id && <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 rounded px-1">account</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${roleColor(t.role)}`}>{t.role}</span>
                  <button onClick={() => handleRemove(t.id)} className="text-[10px] text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.totalCount === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No members yet. Add travellers to this trip.</p>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddForm(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Add Traveller</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Name *</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" autoFocus /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Optional" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="adult">👤 Adult</option><option value="child">👦 Child (2-17)</option><option value="infant">👶 Infant (0-2)</option>
                </select>
              </div>
              {data?.groups?.length > 0 && (
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Group</label>
                  <select value={newGroupId} onChange={e => setNewGroupId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">No group</option>
                    {data.groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddForm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleAddTraveller} className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Form */}
      {showGroupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGroupForm(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create Group</h3>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Group Name</label><input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Smith Family" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" autoFocus /></div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowGroupForm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleCreateGroup} className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white font-medium">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Family Picker Modal */}
      {showFamilyPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFamilyPicker(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Family Members</h3>
            <p className="text-sm text-gray-500 mb-4">Select family members to add to this trip as a "Family" group. Their preferences will auto-apply.</p>

            {familyMembers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">No family members added yet.</p>
                <a href="/connections" className="text-primary-600 text-sm hover:underline mt-1 inline-block">Go to My Network → Family tab to add members</a>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {familyMembers.map(fm => (
                  <div key={fm.id} className="flex items-center gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{fm.firstName} {fm.lastName ?? ''}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">{fm.relationship}</span>
                        {fm.allergies.length > 0 && <span className="text-[10px] text-red-500">⚠️ {fm.allergies.join(', ')}</span>}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setAddingFamily(true);
                        try {
                          await api.post(`/api/trips/${tripId}/members`, {
                            displayName: `${fm.firstName} ${fm.lastName ?? ''}`.trim(),
                            travellerType: fm.relationship === 'child' ? 'child' : 'adult',
                          });
                          // Refresh members list
                          const res = await api.get<{ data: any }>(`/api/trips/${tripId}/members`);
                          setData(res.data);
                        } catch { /* already added or error */ }
                        setAddingFamily(false);
                      }}
                      disabled={addingFamily}
                      className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={() => setShowFamilyPicker(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteForm && (
        <InviteModal tripId={tripId} groups={data?.groups ?? []} onClose={() => setShowInviteForm(false)} onInvited={() => { setShowInviteForm(false); loadInvitations(); }} />
      )}

      {/* Pending Invitations */}
      {invitations.filter(i => i.status === 'pending').length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">Pending Invitations ({invitations.filter(i => i.status === 'pending').length})</p>
          <div className="space-y-2">
            {invitations.filter(i => i.status === 'pending').map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{inv.channel === 'email' ? '📧' : inv.channel === 'phone' ? '📱' : inv.channel === 'whatsapp' ? '💬' : '🔗'}</span>
                  <span className="text-gray-700">{inv.recipient ?? 'Link invite'}</span>
                  <span className="text-xs text-gray-400">· {inv.role}</span>
                  {inv.expires_at && <span className="text-xs text-amber-600">· expires {new Date(inv.expires_at).toLocaleDateString()}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => resendInvitation(inv.id)} className="text-xs text-blue-600 hover:underline">Resend</button>
                  <button onClick={() => cancelInvitation(inv.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ tripId, groups, onClose, onInvited }: { tripId: string; groups: any[]; onClose: () => void; onInvited: () => void }) {
  const [channel, setChannel] = useState<'email' | 'phone' | 'whatsapp' | 'link'>('email');
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState('editor');
  const [groupId, setGroupId] = useState('');
  const [message, setMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [networkSuggestions, setNetworkSuggestions] = useState<Array<{ id: string; name: string; email: string | null; label: string | null }>>([]);
  const [showNetwork, setShowNetwork] = useState(false);

  // Fetch connected users for quick selection
  useEffect(() => {
    api.get<{ data: Array<{ id: string; name: string; email: string | null; label: string | null }> }>('/api/connections/suggest')
      .then(res => setNetworkSuggestions(res.data ?? []))
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await api.post<{ data: { acceptUrl: string } }>(`/api/trips/${tripId}/invitations`, {
        channel, recipient: channel === 'link' ? undefined : recipient,
        role, groupId: groupId || undefined, message: message || undefined, expiresInDays,
      });
      if (channel === 'link' && res.data?.acceptUrl) {
        setGeneratedLink(res.data.acceptUrl);
      } else {
        onInvited();
      }
    } catch { alert('Failed to send invitation'); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite to Trip</h3>

        {generatedLink ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Share this link:</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={generatedLink} className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-mono bg-gray-50" />
              <button onClick={() => { navigator.clipboard.writeText(generatedLink); }} className="rounded-md bg-primary-600 px-3 py-2 text-xs text-white">Copy</button>
            </div>
            <button onClick={onInvited} className="w-full rounded-md border border-gray-300 py-2 text-sm mt-2">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Channel selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['email', '📧 Email'], ['phone', '📱 Phone'], ['whatsapp', '💬 WhatsApp'], ['link', '🔗 Link']] as const).map(([ch, label]) => (
                <button key={ch} onClick={() => setChannel(ch as any)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${channel === ch ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Recipient */}
            {channel !== 'link' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{channel === 'email' ? 'Email address' : 'Phone number'}</label>

                {/* My Network quick-select */}
                {channel === 'email' && networkSuggestions.length > 0 && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => setShowNetwork(!showNetwork)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      👥 Select from My Network ({networkSuggestions.length})
                      <span className={`transition-transform ${showNetwork ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showNetwork && (
                      <div className="mt-1.5 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                        {networkSuggestions.filter(s => s.email).map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => { setRecipient(contact.email!); setShowNetwork(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary-50 transition-colors ${recipient === contact.email ? 'bg-primary-50' : ''}`}
                          >
                            <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary-600 text-[10px] font-bold">{contact.name.charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">{contact.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{contact.email}</p>
                            </div>
                            {contact.label && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded flex-shrink-0">{contact.label}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <input type={channel === 'email' ? 'email' : 'tel'} value={recipient} onChange={e => setRecipient(e.target.value)}
                  placeholder={channel === 'email' ? 'friend@example.com' : '+1234567890'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            )}

            {/* Role */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expires</label>
                <select value={expiresInDays} onChange={e => setExpiresInDays(Number(e.target.value))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={0}>Never</option>
                </select>
              </div>
            </div>

            {/* Group */}
            {groups.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Add to group</label>
                <select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">No group</option>
                  {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Personal message (optional)</label>
              <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Join us on our trip!"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSend} disabled={sending || (channel !== 'link' && !recipient)}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {sending ? 'Sending...' : channel === 'link' ? 'Generate Link' : 'Send Invitation'}
              </button>
            </div>
          </div>
        )}
      </div>
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
