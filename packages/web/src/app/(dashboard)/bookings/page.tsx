'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Booking {
  id: string;
  type: 'flight' | 'hotel' | 'car_rental';
  trip_id: string | null;
  checked_in: boolean;
  created_at: string;
  source?: string;
  status?: string;
  flight_details?: {
    airline?: string;
    flight_number?: string;
    departure_airport?: string;
    arrival_airport?: string;
    departure_time?: string;
    arrival_time?: string;
    confirmation_number?: string;
    cabin_class?: string;
    seat?: string;
  };
  hotel_details?: {
    hotel_name?: string;
    address?: string;
    checkin_date?: string;
    checkout_date?: string;
    confirmation_number?: string;
    room_type?: string;
  };
  car_rental_details?: {
    company?: string;
    vehicle_class?: string;
    pickup_time?: string;
    return_time?: string;
    pickup_location?: string;
    confirmation_number?: string;
  };
}

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  car_rental: '🚗',
};

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  active: 'bg-amber-100 text-amber-700',
  completed: 'bg-gray-100 text-gray-500',
};

const SOURCE_ICONS: Record<string, string> = {
  email: '📧',
  scan: '📷',
  pdf: '📄',
  manual: '✍️',
  api: '🔗',
};

function formatShortDate(d: string | undefined) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(d: string | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getBookingSummary(booking: Booking): { title: string; subtitle: string; ref?: string } {
  if (booking.type === 'flight' && booking.flight_details) {
    const fd = booking.flight_details;
    const title = `${fd.airline ?? 'Flight'} ${fd.flight_number ?? ''}`.trim();
    const route = fd.departure_airport && fd.arrival_airport ? `${fd.departure_airport} → ${fd.arrival_airport}` : '';
    const time = fd.departure_time ? `${formatShortDate(fd.departure_time)} ${formatTime(fd.departure_time)}` : '';
    const parts = [route, time, fd.cabin_class, fd.seat ? `Seat ${fd.seat}` : ''].filter(Boolean);
    return { title, subtitle: parts.join(' · '), ref: fd.confirmation_number };
  }
  if (booking.type === 'hotel' && booking.hotel_details) {
    const hd = booking.hotel_details;
    const title = hd.hotel_name ?? 'Hotel';
    const dates = hd.checkin_date && hd.checkout_date
      ? `${formatShortDate(hd.checkin_date)}–${formatShortDate(hd.checkout_date)}`
      : '';
    const nights = hd.checkin_date && hd.checkout_date
      ? `${Math.round((new Date(hd.checkout_date).getTime() - new Date(hd.checkin_date).getTime()) / 86400000)}n`
      : '';
    const parts = [hd.room_type, dates ? `${dates} (${nights})` : '', hd.address?.split(',')[1]?.trim()].filter(Boolean);
    return { title, subtitle: parts.join(' · '), ref: hd.confirmation_number };
  }
  if (booking.type === 'car_rental' && booking.car_rental_details) {
    const cd = booking.car_rental_details;
    const title = cd.company ?? 'Car Rental';
    const dates = cd.pickup_time && cd.return_time
      ? `${formatShortDate(cd.pickup_time)}–${formatShortDate(cd.return_time)}`
      : '';
    const parts = [cd.vehicle_class, dates, cd.pickup_location].filter(Boolean);
    return { title, subtitle: parts.join(' · '), ref: cd.confirmation_number };
  }
  return { title: booking.type.replace('_', ' '), subtitle: `Created ${new Date(booking.created_at).toLocaleDateString()}` };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data?: Booking[]; bookings?: Booking[] }>('/api/bookings')
      .then((res) => setBookings(res.data ?? res.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <span className="text-sm text-gray-400">{bookings.length} total</span>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-lg text-gray-500">No bookings yet</p>
          <p className="mt-2 text-sm text-gray-400">
            Connect your email to automatically import bookings, or add them manually.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => {
            const { title, subtitle, ref } = getBookingSummary(booking);
            return (
              <a
                key={booking.id}
                href={booking.trip_id ? `/trips/${booking.trip_id}` : '#'}
                className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
              >
                <span className="text-xl flex-shrink-0">{TYPE_ICONS[booking.type] ?? '📋'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm truncate">{title}</p>
                    {ref && <span className="flex-shrink-0 font-mono text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5">{ref}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {booking.source && (
                    <span className="text-xs" title={`Source: ${booking.source}`}>{SOURCE_ICONS[booking.source] ?? '📋'}</span>
                  )}
                  {booking.status && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[booking.status] ?? ''}`}>{booking.status}</span>
                  )}
                  {booking.checked_in && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">✓</span>
                  )}
                  <span className="text-gray-300 text-sm ml-1">→</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
