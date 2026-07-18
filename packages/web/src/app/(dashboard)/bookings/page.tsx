'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Booking {
  id: string;
  type: 'flight' | 'hotel' | 'car_rental';
  trip_id: string | null;
  checked_in: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  car_rental: '🚗',
};

const TYPE_LABELS: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car_rental: 'Car Rental',
};

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
      {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-lg text-gray-500">No bookings yet</p>
          <p className="mt-2 text-sm text-gray-400">
            Connect your email to automatically import bookings, or add them manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 border border-gray-200 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[booking.type] ?? '📋'}</span>
                <div>
                  <p className="font-medium text-gray-900">{TYPE_LABELS[booking.type] ?? booking.type}</p>
                  <p className="text-xs text-gray-500">
                    Created {new Date(booking.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {booking.checked_in && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Checked In
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
