'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface SearchResult {
  name: string;
  description: string;
  category: string;
  rating: number;
  estimatedCost: { amount: number; currency: string };
  distanceKm?: number;
  matchScore: number;
  dietaryCompatible?: boolean;
  dietaryLabels?: string[];
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    minRating: 0,
    maxDistance: 50,
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || query.length < 2) return;

    setLoading(true);
    try {
      const res = await api.post<{ data: { results: SearchResult[] } }>('/api/search', {
        query,
        filters: {
          ...(filters.category && { category: [filters.category] }),
          ...(filters.minRating > 0 && { minRating: filters.minRating }),
          ...(filters.maxDistance < 50 && { maxDistance: filters.maxDistance }),
        },
      });
      setResults(res.data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">AI Search</h1>
      <p className="text-sm text-gray-500">
        Search for activities, restaurants, and places using natural language.
      </p>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 'cozy Italian restaurants near the beach'"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            minLength={2}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={loading || query.length < 2}
            className="rounded-md bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Categories</option>
            <option value="restaurant">Restaurants</option>
            <option value="activity">Activities</option>
            <option value="attraction">Attractions</option>
            <option value="shopping">Shopping</option>
            <option value="nightlife">Nightlife</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            Min Rating:
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={filters.minRating}
              onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
              className="w-16 rounded-md border border-gray-300 px-2 py-1"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            Max Distance:
            <input
              type="range"
              min={1}
              max={50}
              value={filters.maxDistance}
              onChange={(e) => setFilters({ ...filters, maxDistance: parseInt(e.target.value) })}
              className="w-24"
            />
            <span>{filters.maxDistance}km</span>
          </label>
        </div>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{results.length} results found</p>
          {results.map((result, i) => (
            <div key={i} className="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{result.name}</h3>
                    {result.dietaryLabels?.map((label) => (
                      <span key={label} className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{result.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>⭐ {result.rating.toFixed(1)}</span>
                    <span>{result.category}</span>
                    {result.distanceKm && <span>{result.distanceKm.toFixed(1)}km away</span>}
                    <span>~{result.estimatedCost.currency}{result.estimatedCost.amount}</span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <span className="text-xs text-gray-400">
                    {Math.round(result.matchScore * 100)}% match
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query.length >= 2 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No results found. Try broadening your search.</p>
        </div>
      )}
    </div>
  );
}
