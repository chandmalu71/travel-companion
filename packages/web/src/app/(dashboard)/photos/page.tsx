'use client';

import { useState } from 'react';

/**
 * Global Photos Gallery (Left Sidebar)
 * 
 * Shows all user photos across all trips.
 * Filterable by trip, date, album, visibility, tags.
 * 
 * Status: UI STUB — Premium feature, implementation deferred to mobile app phase.
 */

export default function PhotosPage() {
  const [filter, setFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [tripFilter, setTripFilter] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Photos</h1>
          <p className="text-sm text-gray-500 mt-1">All your trip memories in one place</p>
        </div>
        <button className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
          + Upload Photos
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Photos</option>
          <option value="personal">Personal Only</option>
          <option value="shared">Shared Only</option>
        </select>
        <select
          value={tripFilter}
          onChange={(e) => setTripFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Trips</option>
          <option value="trip1">Barcelona Long Weekend</option>
          <option value="trip2">Japan Adventure 2027</option>
          <option value="trip3">Greek Islands Cruise</option>
        </select>
        <input
          type="text"
          placeholder="Filter by tag..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Premium Gate */}
      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <p className="text-4xl mb-3">📸</p>
        <h3 className="text-lg font-semibold text-gray-900">Trip Photos</h3>
        <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
          Upload, organize, and share your travel photos with trip companions.
          Create albums, tag moments, and relive your adventures.
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Premium Feature
          </span>
        </div>
        <button className="mt-4 rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
          Upgrade to Premium
        </button>
        <p className="text-xs text-gray-400 mt-3">Coming soon with mobile app</p>
      </div>

      {/* Placeholder grid (shows what it would look like) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-40 pointer-events-none">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
