'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ─── Constants from Requirements ─────────────────────────────────────────────

const INTEREST_OPTIONS = [
  { id: 'adventure', label: 'Adventure', icon: '🏔️' },
  { id: 'arts_culture', label: 'Arts & Culture', icon: '🎨' },
  { id: 'beaches', label: 'Beaches', icon: '🏖️' },
  { id: 'food_drink', label: 'Food & Drink', icon: '🍕' },
  { id: 'history', label: 'History', icon: '🏛️' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'nightlife', label: 'Nightlife', icon: '🌃' },
  { id: 'photography', label: 'Photography', icon: '📷' },
  { id: 'relaxation', label: 'Relaxation', icon: '🧘' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'wellness', label: 'Wellness', icon: '💆' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
  { id: 'gluten_free', label: 'Gluten Free', icon: '🌾' },
  { id: 'dairy_free', label: 'Dairy Free', icon: '🥛' },
  { id: 'halal', label: 'Halal', icon: '☪️' },
  { id: 'kosher', label: 'Kosher', icon: '✡️' },
  { id: 'nut_free', label: 'Nut Free', icon: '🥜' },
  { id: 'low_carb', label: 'Low Carb', icon: '🍞' },
  { id: 'keto', label: 'Keto', icon: '🥑' },
  { id: 'none', label: 'None', icon: '✅' },
];

// 10 known allergies from requirements (Req 20.3)
const KNOWN_ALLERGIES = [
  { id: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { id: 'tree_nuts', label: 'Tree Nuts', icon: '🌰' },
  { id: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { id: 'fish', label: 'Fish', icon: '🐟' },
  { id: 'eggs', label: 'Eggs', icon: '🥚' },
  { id: 'milk', label: 'Milk/Dairy', icon: '🥛' },
  { id: 'soy', label: 'Soy', icon: '🫘' },
  { id: 'wheat', label: 'Wheat', icon: '🌾' },
  { id: 'sesame', label: 'Sesame', icon: '🫒' },
  { id: 'sulfites', label: 'Sulfites', icon: '🍷' },
];

// Major currencies for display (Req 20.7)
const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'MXN', label: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [preferences, setPreferences] = useState({
    interests: [] as string[],
    dietaryPreferences: [] as string[],
    allergies: [] as string[],
    language: 'en',
    displayCurrencies: ['USD'] as string[],
    temperatureUnit: 'celsius',
    distanceUnit: 'km',
  });
  const [customAllergyInput, setCustomAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const userId = 'me';
    api.get<{ data: any }>(`/api/users/${userId}/preferences`)
      .then((res) => {
        if (res.data) setPreferences({ ...preferences, ...res.data });
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/users/me/preferences', preferences);
      // Also save locale preferences
      await api.put('/api/users/me/locale', { language: preferences.language }).catch(() => {});
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

  function toggleAllergy(allergy: string) {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter((a) => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  }

  function addCustomAllergy() {
    const trimmed = customAllergyInput.trim();
    if (trimmed && trimmed.length <= 50 && !preferences.allergies.includes(trimmed)) {
      setPreferences((prev) => ({
        ...prev,
        allergies: [...prev.allergies, trimmed],
      }));
      setCustomAllergyInput('');
    }
  }

  function removeAllergy(allergy: string) {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((a) => a !== allergy),
    }));
  }

  function toggleCurrency(code: string) {
    setPreferences((prev) => {
      const current = prev.displayCurrencies;
      if (current.includes(code)) {
        // Don't allow removing the last currency
        if (current.length <= 1) return prev;
        return { ...prev, displayCurrencies: current.filter((c) => c !== code) };
      }
      return { ...prev, displayCurrencies: [...current, code] };
    });
  }

  function setDefaultCurrency(code: string) {
    setPreferences((prev) => {
      const others = prev.displayCurrencies.filter((c) => c !== code);
      return { ...prev, displayCurrencies: [code, ...others] };
    });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>

      {/* ─── Email Connection Quick Link ────────────────────────────── */}
      <section className="rounded-lg border border-primary-200 bg-primary-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">📧 Email Connections</h3>
            <p className="text-sm text-gray-600 mt-1">
              Connect your inbox to auto-import booking confirmations into your trips.
            </p>
          </div>
          <a
            href="/settings/email-connections"
            className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 whitespace-nowrap"
          >
            Manage →
          </a>
        </div>
      </section>

      {/* ─── Home Location Quick Link ─────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">🏠 Home & Travel</h3>
            <p className="text-sm text-gray-600 mt-1">
              Set your home location for personalized leave-by times, directions, and timezone info.
            </p>
          </div>
          <a
            href="/settings/home-location"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 whitespace-nowrap"
          >
            Set Up →
          </a>
        </div>
      </section>

      {/* ─── Interests ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Interests</h2>
        <p className="text-sm text-gray-500 mb-3">Select your travel interests to personalize recommendations.</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest.id}
              onClick={() => toggleInterest(interest.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.interests.includes(interest.id)
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {interest.icon} {interest.label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Dietary Preferences ────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Dietary Preferences</h2>
        <p className="text-sm text-gray-500 mb-3">We'll use these to filter restaurant recommendations.</p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((pref) => (
            <button
              key={pref.id}
              onClick={() => toggleDietary(pref.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.dietaryPreferences.includes(pref.id)
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {pref.icon} {pref.label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Allergies ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Allergies</h2>
        <p className="text-sm text-gray-500 mb-3">
          Select known allergies or add custom ones. Results containing allergens will be excluded.
        </p>

        {/* Known allergies as selectable chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {KNOWN_ALLERGIES.map((allergy) => (
            <button
              key={allergy.id}
              onClick={() => toggleAllergy(allergy.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.allergies.includes(allergy.id)
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {allergy.icon} {allergy.label}
            </button>
          ))}
        </div>

        {/* Custom allergy input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={customAllergyInput}
            onChange={(e) => setCustomAllergyInput(e.target.value)}
            placeholder="Add a custom allergy (max 50 chars)"
            maxLength={50}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAllergy())}
          />
          <button
            onClick={addCustomAllergy}
            className="rounded-md bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300"
          >
            Add
          </button>
        </div>

        {/* Show custom allergies (ones not in the known list) */}
        {preferences.allergies.filter((a) => !KNOWN_ALLERGIES.some((k) => k.id === a)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 self-center">Custom:</span>
            {preferences.allergies
              .filter((a) => !KNOWN_ALLERGIES.some((k) => k.id === a))
              .map((allergy) => (
                <span
                  key={allergy}
                  className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                >
                  {allergy}
                  <button
                    onClick={() => removeAllergy(allergy)}
                    className="ml-1 text-red-400 hover:text-red-600"
                    aria-label={`Remove ${allergy}`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        )}
      </section>

      {/* ─── Display Currencies ─────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Display Currencies</h2>
        <p className="text-sm text-gray-500 mb-3">
          Select currencies to display. The first one is your default. Click the star to change the default.
        </p>

        <div className="space-y-2">
          {/* Selected currencies (reorderable) */}
          {preferences.displayCurrencies.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Your currencies (first = default):</p>
              <div className="flex flex-wrap gap-2">
                {preferences.displayCurrencies.map((code, idx) => {
                  const currency = CURRENCY_OPTIONS.find((c) => c.code === code);
                  return (
                    <span
                      key={code}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                        idx === 0
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : 'bg-primary-50 text-primary-700 border border-primary-200'
                      }`}
                    >
                      {idx === 0 && <span title="Default currency">⭐</span>}
                      {idx !== 0 && (
                        <button
                          onClick={() => setDefaultCurrency(code)}
                          title="Set as default"
                          className="text-gray-400 hover:text-yellow-600"
                        >
                          ☆
                        </button>
                      )}
                      {currency?.symbol ?? code} {code}
                      {preferences.displayCurrencies.length > 1 && (
                        <button
                          onClick={() => toggleCurrency(code)}
                          className="ml-1 text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${code}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available currencies to add */}
          <div className="flex flex-wrap gap-2">
            {CURRENCY_OPTIONS.filter((c) => !preferences.displayCurrencies.includes(c.code)).map((currency) => (
              <button
                key={currency.code}
                onClick={() => toggleCurrency(currency.code)}
                className="rounded-full px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors"
              >
                {currency.symbol} {currency.code}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Display Units ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Display Units</h2>
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

      {/* ─── Language & Region ──────────────────────────────────────── */}
      <LanguageRegionSection preferences={preferences} onChange={(updates) => setPreferences({ ...preferences, ...updates })} />

      {/* ─── Save ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-8">
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

// ─── Language & Region Section ───────────────────────────────────────────────

function LanguageRegionSection({ preferences, onChange }: { preferences: any; onChange: (updates: any) => void }) {
  const [languages, setLanguages] = useState<Array<{ code: string; name: string; native_name: string }>>([]);
  const [locales, setLocales] = useState<Array<{ code: string; name: string; date_format: string; time_format: string; number_format: string; default_currency: string; units: string }>>([]);
  const [selectedLocale, setSelectedLocale] = useState('');

  useEffect(() => {
    api.get<{ data: any[] }>('/api/i18n/languages').then(r => setLanguages(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/i18n/locales').then(r => setLocales(r.data ?? [])).catch(() => {});
    // Load user's saved locale
    api.get<{ data: { locale?: string; language?: string } }>('/api/users/me/locale')
      .then(r => {
        if (r.data?.locale) setSelectedLocale(r.data.locale);
        if (r.data?.language) onChange({ language: r.data.language });
      })
      .catch(() => {});
  }, []);

  const handleLocaleChange = (code: string) => {
    setSelectedLocale(code);
    const loc = locales.find(l => l.code === code);
    if (loc) {
      onChange({ language: loc.code.split('-')[0] });
    }
    // Also save to user locale preferences
    api.put('/api/users/me/locale', { locale: code, language: loc?.code.split('-')[0] ?? 'en' }).catch(() => {});
  };

  const currentLocale = locales.find(l => l.code === selectedLocale);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Language & Region</h2>

      {/* Language selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Display Language</label>
        <select
          value={preferences.language}
          onChange={(e) => {
            onChange({ language: e.target.value });
            api.put('/api/users/me/locale', { language: e.target.value }).catch(() => {});
          }}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {languages.length > 0 ? (
            languages.map(l => <option key={l.code} value={l.code}>{l.native_name} ({l.name})</option>)
          ) : (
            <option value="">Loading languages...</option>
          )}
        </select>
        <p className="text-xs text-gray-400 mt-1">Configured by admin — {languages.length} languages available</p>
      </div>

      {/* Locale/Region selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Region & Formatting</label>
        <select
          value={selectedLocale}
          onChange={(e) => handleLocaleChange(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a region...</option>
          {locales.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <p className="text-xs text-gray-400 mt-1">Configured by admin — {locales.length} regions available</p>
      </div>

      {/* Preview current format settings */}
      {currentLocale && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-4 max-w-xs">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Format Preview</p>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{currentLocale.date_format}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time:</span><span>{currentLocale.time_format}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Numbers:</span><span>{currentLocale.number_format}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Currency:</span><span>{currentLocale.default_currency}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Units:</span><span>{currentLocale.units}</span></div>
          </div>
        </div>
      )}

      {/* Units override */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Measurement Units</label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="units" value="metric" checked={preferences.temperatureUnit === 'celsius'} onChange={() => onChange({ temperatureUnit: 'celsius' })} className="text-primary-600" />
            <span className="text-sm">Metric (km, °C, kg)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="units" value="imperial" checked={preferences.temperatureUnit === 'fahrenheit'} onChange={() => onChange({ temperatureUnit: 'fahrenheit' })} className="text-primary-600" />
            <span className="text-sm">Imperial (mi, °F, lb)</span>
          </label>
        </div>
      </div>
    </section>
  );
}
