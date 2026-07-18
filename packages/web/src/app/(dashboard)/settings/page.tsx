'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const INTEREST_OPTIONS = [
  'adventure', 'arts_culture', 'beaches', 'food_drink', 'history', 'nature',
  'nightlife', 'photography', 'relaxation', 'shopping', 'sports', 'wellness',
];

const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'dairy_free',
  'halal', 'kosher', 'nut_free', 'low_carb', 'keto', 'none',
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState({
    interests: [] as string[],
    dietaryPreferences: [] as string[],
    allergies: [] as string[],
    language: 'en',
    displayCurrencies: ['USD'],
    temperatureUnit: 'celsius',
    distanceUnit: 'km',
  });
  const [allergyInput, setAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Fetch current preferences
    const userId = 'me'; // In production, get from auth context
    api.get<{ data: any }>(`/api/users/${userId}/preferences`)
      .then((res) => {
        if (res.data) setPreferences(res.data);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/users/me/preferences', preferences);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  }

  function toggleInterest(interest: string) {
    setPreferences((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  function toggleDietary(pref: string) {
    setPreferences((prev) => ({
      ...prev,
      dietaryPreferences: prev.dietaryPreferences.includes(pref)
        ? prev.dietaryPreferences.filter((d) => d !== pref)
        : [...prev.dietaryPreferences, pref],
    }));
  }

  function addAllergy() {
    if (allergyInput.trim() && allergyInput.length <= 50) {
      setPreferences((prev) => ({
        ...prev,
        allergies: [...prev.allergies, allergyInput.trim()],
      }));
      setAllergyInput('');
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>

      {/* Interests */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Interests</h2>
        <p className="text-sm text-gray-500 mb-3">Select your travel interests to personalize recommendations.</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.interests.includes(interest)
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {interest.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      {/* Dietary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Dietary Preferences</h2>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((pref) => (
            <button
              key={pref}
              onClick={() => toggleDietary(pref)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.dietaryPreferences.includes(pref)
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {pref.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      {/* Allergies */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Allergies</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            placeholder="Add an allergy (max 50 chars)"
            maxLength={50}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
          />
          <button onClick={addAllergy} className="rounded-md bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {preferences.allergies.map((allergy, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
              {allergy}
              <button
                onClick={() => setPreferences((p) => ({ ...p, allergies: p.allergies.filter((_, idx) => idx !== i) }))}
                className="ml-1 text-red-400 hover:text-red-600"
                aria-label={`Remove ${allergy}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Display settings */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Display</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
            <select
              value={preferences.temperatureUnit}
              onChange={(e) => setPreferences({ ...preferences, temperatureUnit: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="celsius">Celsius (°C)</option>
              <option value="fahrenheit">Fahrenheit (°F)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
            <select
              value={preferences.distanceUnit}
              onChange={(e) => setPreferences({ ...preferences, distanceUnit: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="km">Kilometers (km)</option>
              <option value="miles">Miles (mi)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully!</span>}
      </div>
    </div>
  );
}
