'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewTripPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Trip name is required');
      return;
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ id: string } | { data: { id: string } }>('/api/trips', {
        name: formData.name.trim(),
        destination: formData.destination.trim() || undefined,
        start_date: formData.startDate || undefined,
        end_date: formData.endDate || undefined,
      });

      const tripId = (res as any).id ?? (res as any).data?.id;
      router.push(`/trips/${tripId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Trip</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Trip Name *
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={100}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Summer in Italy"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700">
            Destination
          </label>
          <input
            id="destination"
            type="text"
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            placeholder="e.g., Rome, Italy"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Trip'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
