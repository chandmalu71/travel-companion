'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const TRANSPORT_MODES = [
  { id: 'drive', label: 'Drive (own car)', icon: '🚗', estimate: '~45 min' },
  { id: 'taxi', label: 'Taxi / Rideshare', icon: '🚕', estimate: '~50 min' },
  { id: 'public_transport', label: 'Public Transport', icon: '🚌', estimate: '~75 min' },
  { id: 'train', label: 'Train (airport express)', icon: '🚆', estimate: '~60 min' },
  { id: 'drop_off', label: 'Someone drops me off', icon: '👋', estimate: '~40 min' },
];

interface HomeLocation {
  type: 'primary' | 'native';
  city: string;
  country: string;
  address: string | null;
  timezone: string | null;
  nearestAirports: string[];
  transportMode: string | null;
}

export default function HomeLocationPage() {
  const [primary, setPrimary] = useState<HomeLocation | null>(null);
  const [native, setNative] = useState<HomeLocation | null>(null);
  const [editing, setEditing] = useState<'primary' | 'native' | null>(null);
  const [form, setForm] = useState({ city: '', country: '', address: '', transportMode: 'taxi', nearestAirports: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get<{ data: { locations: HomeLocation[] } }>('/api/home-locations')
      .then((res) => {
        const locs = res.data?.locations ?? [];
        setPrimary(locs.find((l) => l.type === 'primary') ?? null);
        setNative(locs.find((l) => l.type === 'native') ?? null);
      })
      .catch(() => {});
  }, []);

  function startEdit(type: 'primary' | 'native') {
    const existing = type === 'primary' ? primary : native;
    setForm({
      city: existing?.city ?? '',
      country: existing?.country ?? '',
      address: existing?.address ?? '',
      transportMode: existing?.transportMode ?? 'taxi',
      nearestAirports: existing?.nearestAirports?.join(', ') ?? '',
    });
    setEditing(type);
  }

  async function handleSave() {
    if (!editing || !form.city || !form.country) return;
    setSaving(true);
    try {
      await api.put(`/api/home-locations/${editing}`, {
        city: form.city,
        country: form.country,
        address: form.address || undefined,
        transportMode: form.transportMode || undefined,
        nearestAirports: form.nearestAirports ? form.nearestAirports.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
      setMessage({ type: 'success', text: `${editing === 'primary' ? 'Home' : 'Native home'} location saved!` });
      setEditing(null);
      // Refresh
      const res = await api.get<{ data: { locations: HomeLocation[] } }>('/api/home-locations');
      const locs = res.data?.locations ?? [];
      setPrimary(locs.find((l) => l.type === 'primary') ?? null);
      setNative(locs.find((l) => l.type === 'native') ?? null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save' });
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Home & Travel</h1>
          <p className="text-sm text-gray-500 mt-1">Set your home location to get personalized trip planning (leave-by times, directions, timezone info).</p>
        </div>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">← Settings</Link>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Primary Home */}
      <LocationCard
        title="🏠 Primary Home"
        subtitle="Where you currently live"
        location={primary}
        onEdit={() => startEdit('primary')}
      />

      {/* Native Home */}
      <LocationCard
        title="🏡 Native Home"
        subtitle="Family/origin home (for expats who travel between both)"
        location={native}
        onEdit={() => startEdit('native')}
      />

      {/* Edit Form */}
      {editing && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {editing === 'primary' ? '🏠 Set Primary Home' : '🏡 Set Native Home'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g., London" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g., United Kingdom" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Address (optional — for precise directions)</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="e.g., 42 Baker Street, London W1U 7EU" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nearest Airport(s) — comma separated</label>
            <input type="text" value={form.nearestAirports} onChange={(e) => setForm({ ...form, nearestAirports: e.target.value })}
              placeholder="e.g., LHR, LGW, STN" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Use IATA airport codes. Leave blank to auto-detect.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How do you usually get to the airport?</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRANSPORT_MODES.map((mode) => (
                <button key={mode.id} type="button"
                  onClick={() => setForm({ ...form, transportMode: mode.id })}
                  className={`rounded-lg border p-3 text-left text-sm transition-all ${
                    form.transportMode === mode.id
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="text-lg">{mode.icon}</span>
                  <p className="font-medium text-gray-900 mt-1">{mode.label}</p>
                  <p className="text-xs text-gray-400">{mode.estimate}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.city || !form.country}
              className="rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Location'}
            </button>
            <button onClick={() => setEditing(null)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationCard({ title, subtitle, location, onEdit }: {
  title: string; subtitle: string; location: HomeLocation | null; onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <button onClick={onEdit}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
          {location ? 'Edit' : 'Set Up'}
        </button>
      </div>

      {location ? (
        <div className="mt-3 space-y-1">
          <p className="text-sm text-gray-900">📍 {location.city}, {location.country}</p>
          {location.address && <p className="text-xs text-gray-500">{location.address}</p>}
          {location.nearestAirports.length > 0 && (
            <p className="text-xs text-gray-500">✈️ Nearest airports: {location.nearestAirports.join(', ')}</p>
          )}
          {location.transportMode && (
            <p className="text-xs text-gray-500">🚗 Transport: {location.transportMode.replace('_', ' ')}</p>
          )}
          {location.timezone && (
            <p className="text-xs text-gray-500">🕐 Timezone: {location.timezone}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-400 italic">Not set — tap "Set Up" to add your location</p>
      )}
    </div>
  );
}
