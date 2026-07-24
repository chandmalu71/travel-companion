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
  const [showScanModal, setShowScanModal] = useState(false);

  const loadBookings = () => {
    api.get<{ data?: Booking[]; bookings?: Booking[] }>('/api/bookings')
      .then((res) => setBookings(res.data ?? res.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBookings(); }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowScanModal(true)} className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            📄 Upload Confirmation
          </button>
          <span className="text-sm text-gray-400 self-center">{bookings.length} total</span>
        </div>
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

      {/* Upload Confirmation Modal */}
      {showScanModal && (
        <ScanBookingModal
          onClose={() => setShowScanModal(false)}
          onCreated={() => { setShowScanModal(false); loadBookings(); }}
        />
      )}
    </div>
  );
}

// ─── Scan Booking Modal ──────────────────────────────────────────────────────

function ScanBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');
    setResult(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError('');

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const res = await api.post<any>('/api/bookings/scan', {
        image: base64,
        mimeType: file.type,
      });

      if (res.statusCode === 200 || res.data) {
        setResult(res.data ?? res);
        // Auto-close after short delay to show success
        setTimeout(() => onCreated(), 1500);
      } else {
        setError(res.message || 'Could not extract booking details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan document. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Booking Confirmation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload a screenshot or photo of your booking confirmation (flight, hotel, or car rental). AI will extract the details automatically.
        </p>

        {/* File input */}
        <label className="block cursor-pointer">
          <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            preview ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}>
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
            ) : (
              <div>
                <span className="text-3xl">📄</span>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Click to upload or drag & drop</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">JPEG, PNG, WebP — Max 10MB</p>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              ✓ {result.type?.replace('_', ' ')} booking created
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Confidence: {Math.round((result.confidence ?? 0) * 100)}%
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleScan}
            disabled={!file || scanning}
            className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </span>
            ) : (
              'Scan & Create Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
