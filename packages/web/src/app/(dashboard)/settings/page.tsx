'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/i18n';

// ─── Options fetched from Admin-configured API ──────────────────────────────
// Interests, Dietary, Allergies, and Currencies are all managed in the Admin panel.
// The settings page fetches enabled options from the API on mount.

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation();
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

  // Admin-managed option lists (fetched from API)
  const [INTEREST_OPTIONS, setInterestOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);
  const [DIETARY_OPTIONS, setDietaryOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);
  const [KNOWN_ALLERGIES, setAllergyOptions] = useState<Array<{ key: string; name: string; icon: string }>>([]);
  const [CURRENCY_OPTIONS, setCurrencyOptions] = useState<Array<{ code: string; name: string; symbol: string }>>([]);

  useEffect(() => {
    // Fetch admin-configured options
    api.get<{ data: any[] }>('/api/preferences/interests').then(r => setInterestOptions(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/preferences/dietary').then(r => setDietaryOptions(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/preferences/allergies').then(r => setAllergyOptions(r.data ?? [])).catch(() => {});
    api.get<{ data: any[] }>('/api/i18n/currencies').then(r => setCurrencyOptions(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const userId = 'me';
    api.get<{ data: any }>(`/api/users/${userId}/preferences`)
      .then((res) => {
        if (res.data) setPreferences({ ...preferences, ...res.data });
      })
      .catch(() => {});
  }, []);

  const [saveError, setSaveError] = useState('');

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await api.put('/api/users/me/preferences', {
        interests: preferences.interests,
        dietaryPreferences: preferences.dietaryPreferences,
        allergies: preferences.allergies,
        language: preferences.language,
        displayCurrencies: preferences.displayCurrencies,
      });
      // Also save locale preferences
      await api.put('/api/users/me/locale', { language: preferences.language }).catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save preferences. Please try again.');
      setTimeout(() => setSaveError(''), 5000);
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
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: Profile & Account
          ═══════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 pb-2">
        <h2 className="text-xl font-semibold text-gray-900">Profile & Account</h2>
        <p className="text-sm text-gray-500">Manage your account settings and connections</p>
      </div>

      {/* ─── Profile Name ─────────────────────────────────────────────── */}
      <ProfileNameSection />

      {/* ─── Extended Profile (DOB, Anniversary, Location) ────────────── */}
      <ExtendedProfileSection />

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

      {/* ─── Email Aliases ────────────────────────────────────────────── */}
      <EmailAliasesSection />

      {/* ─── Subscription ─────────────────────────────────────────────── */}
      <SubscriptionSection />

      {/* ─── Privacy & Communications ─────────────────────────────────── */}
      <MarketingConsentSection />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: Travel Preferences
          ═══════════════════════════════════════════════════════════════ */}
      <div className="border-b border-gray-200 pb-2 pt-4">
        <h2 className="text-xl font-semibold text-gray-900">Travel Preferences</h2>
        <p className="text-sm text-gray-500">Personalize your travel experience with your preferences</p>
      </div>

      {/* ─── Interests ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.interests')}</h2>
        <p className="text-sm text-gray-500 mb-3">{t('settings.interests.hint')}</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <button
              key={interest.key}
              onClick={() => toggleInterest(interest.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.interests.includes(interest.key)
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {interest.icon} {t(`preferences.interest.${interest.key}`) !== `preferences.interest.${interest.key}` ? t(`preferences.interest.${interest.key}`) : interest.name}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Dietary Preferences ────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.dietary')}</h2>
        <p className="text-sm text-gray-500 mb-3">{t('settings.dietary.hint')}</p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((pref) => (
            <button
              key={pref.key}
              onClick={() => toggleDietary(pref.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.dietaryPreferences.includes(pref.key)
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {pref.icon} {t(`preferences.dietary.${pref.key}`) !== `preferences.dietary.${pref.key}` ? t(`preferences.dietary.${pref.key}`) : pref.name}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Allergies ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.allergies')}</h2>
        <p className="text-sm text-gray-500 mb-3">
          {t('settings.allergies.hint')}
        </p>

        {/* Known allergies as selectable chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {KNOWN_ALLERGIES.map((allergy) => (
            <button
              key={allergy.key}
              onClick={() => toggleAllergy(allergy.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                preferences.allergies.includes(allergy.key)
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {allergy.icon} {t(`preferences.allergy.${allergy.key}`) !== `preferences.allergy.${allergy.key}` ? t(`preferences.allergy.${allergy.key}`) : allergy.name}
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
        {preferences.allergies.filter((a) => !KNOWN_ALLERGIES.some((k) => k.key === a)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 self-center">Custom:</span>
            {preferences.allergies
              .filter((a) => !KNOWN_ALLERGIES.some((k) => k.key === a))
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.currencies')}</h2>
        <p className="text-sm text-gray-500 mb-3">
          {t('settings.currencies.hint')}
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

      {/* ─── Language & Region ──────────────────────────────────────── */}
      <LanguageRegionSection preferences={preferences} onChange={(updates) => setPreferences({ ...preferences, ...updates })} />

      {/* ─── Save ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : t('settings.save')}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✅ {t('settings.saved')}</span>}
        {saveError && <span className="text-sm text-red-600 font-medium">❌ {saveError}</span>}
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


// ─── Email Aliases Section ───────────────────────────────────────────────────

function EmailAliasesSection() {
  const [aliases, setAliases] = useState<Array<{ id: string; email: string; isVerified: boolean; source: string }>>([]);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get<{ data: any[] }>('/api/email-aliases')
      .then(res => setAliases(res.data ?? []))
      .catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setAdding(true); setError(''); setSuccess('');
    try {
      await api.post('/api/email-aliases', { email: newEmail });
      setSuccess('Verification email sent! Check your inbox.');
      setNewEmail('');
      // Reload list
      const res = await api.get<{ data: any[] }>('/api/email-aliases');
      setAliases(res.data ?? []);
    } catch (err: any) {
      setError(err?.data?.message ?? 'Failed to add email');
    } finally { setAdding(false); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this email alias?')) return;
    try {
      await api.delete(`/api/email-aliases/${id}`);
      setAliases(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err?.message ?? 'Failed to remove alias');
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">📧 Email Aliases</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            Add alternate emails so booking confirmations forwarded from any address are matched to your account.
          </p>
        </div>
      </div>

      {/* Existing aliases */}
      {aliases.length > 0 && (
        <div className="space-y-2 mb-3">
          {aliases.map(alias => (
            <div key={alias.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">{alias.email}</span>
                {alias.isVerified ? (
                  <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-1">✓ Verified</span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1">⏳ Pending</span>
                )}
                {alias.source === 'connected' && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1">auto-added</span>
                )}
              </div>
              <button onClick={() => handleRemove(alias.id)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new alias */}
      <div className="flex gap-2">
        <input
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder="work@company.com"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        <button onClick={handleAdd} disabled={adding}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50">
          {adding ? 'Adding...' : 'Add Email'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-600 mt-2">✅ {success}</p>}

      <p className="text-[10px] text-gray-400 mt-2">
        Forwarded bookings from these addresses will be automatically matched to your account.
        A verification email will be sent to confirm ownership.
      </p>
    </section>
  );
}


// ─── Subscription Section ────────────────────────────────────────────────────

function SubscriptionSection() {
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: any }>('/api/subscription')
      .then(res => setSub(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-20 bg-gray-200 rounded-lg" />;

  const planName = sub?.plan_name ?? sub?.planName ?? 'Free';
  const status = sub?.status ?? 'active';
  const trialEnds = sub?.trial_ends_at;
  const periodEnd = sub?.current_period_end;
  const cancelAtEnd = sub?.cancel_at_period_end;

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? Access continues until end of billing period.')) return;
    await api.post('/api/subscription/cancel', {});
    const res = await api.get<{ data: any }>('/api/subscription');
    setSub(res.data);
  };

  const handleReactivate = async () => {
    await api.post('/api/subscription/reactivate', {});
    const res = await api.get<{ data: any }>('/api/subscription');
    setSub(res.data);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">💎 Subscription</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-semibold ${planName === 'Premium' ? 'text-purple-600' : planName === 'Pro' ? 'text-primary-600' : 'text-gray-600'}`}>
              {planName}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              status === 'trialing' ? 'bg-blue-100 text-blue-700' :
              status === 'active' ? 'bg-green-100 text-green-700' :
              status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {status === 'trialing' ? 'Trial' : status === 'active' ? 'Active' : status}
            </span>
            {cancelAtEnd && <span className="text-[10px] text-amber-600">Cancels at period end</span>}
          </div>
          {trialEnds && status === 'trialing' && (
            <p className="text-[10px] text-gray-400 mt-0.5">Trial ends: {new Date(trialEnds).toLocaleDateString()}</p>
          )}
          {periodEnd && status === 'active' && (
            <p className="text-[10px] text-gray-400 mt-0.5">Renews: {new Date(periodEnd).toLocaleDateString()}</p>
          )}
        </div>
        <div className="flex gap-2">
          {(status === 'active' || status === 'trialing') && !cancelAtEnd && (
            <>
              <a href="/pricing" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                {planName === 'Free' ? 'Upgrade' : 'Change Plan'}
              </a>
              {planName !== 'Free' && (
                <button onClick={handleCancel} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                  Cancel
                </button>
              )}
            </>
          )}
          {cancelAtEnd && (
            <button onClick={handleReactivate} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">
              Reactivate
            </button>
          )}
        </div>
      </div>
    </section>
  );
}


// ─── Profile Name Section ────────────────────────────────────────────────────

function ProfileNameSection() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ data: any }>('/api/user/profile')
      .then((res) => {
        if (res.data) {
          setFirstName(res.data.first_name ?? '');
          setLastName(res.data.last_name ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/user/profile', { first_name: firstName, last_name: lastName });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-medium text-gray-900 mb-3">Your Name</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            placeholder="Last name"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </section>
  );
}

// ─── Marketing Consent Section ───────────────────────────────────────────────

function MarketingConsentSection() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ data: any }>('/api/user/profile')
      .then((res) => {
        setConsent(res.data?.marketing_consent ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    const newValue = !consent;
    setSaving(true);
    try {
      await api.put('/api/user/profile', { marketing_consent: newValue });
      setConsent(newValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Privacy & Communications</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Manage how we communicate with you</p>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-800 dark:text-gray-200">Marketing emails</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Travel tips, product updates, and exclusive offers</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              consent ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            role="switch"
            aria-checked={consent}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              consent ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        You can change this at any time. We never share your email with third parties.
      </p>
    </section>
  );
}


// ─── Extended Profile Section ────────────────────────────────────────────────

function ExtendedProfileSection() {
  const [profile, setProfile] = useState({
    date_of_birth: '',
    anniversary_date: '',
    nationality: '',
    current_city: '',
    current_country: '',
    moved_to_city_date: '',
    moved_to_country_date: '',
    phone: '',
    gender: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: any }>('/api/user/profile')
      .then((res) => {
        if (res.data) {
          setProfile(prev => ({
            ...prev,
            date_of_birth: res.data.date_of_birth ?? '',
            anniversary_date: res.data.anniversary_date ?? '',
            nationality: res.data.nationality ?? '',
            current_city: res.data.current_city ?? '',
            current_country: res.data.current_country ?? '',
            moved_to_city_date: res.data.moved_to_city_date ?? '',
            moved_to_country_date: res.data.moved_to_country_date ?? '',
            phone: res.data.phone ?? '',
            gender: res.data.gender ?? '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/user/profile', profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personal Details</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Used for travel recommendations and milestone reminders</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Saved!</span>}
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
          <input type="date" value={profile.date_of_birth} onChange={e => setProfile(p => ({ ...p, date_of_birth: e.target.value }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Anniversary</label>
          <input type="date" value={profile.anniversary_date} onChange={e => setProfile(p => ({ ...p, anniversary_date: e.target.value }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
          <select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white">
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
          <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+358 40 123 4567"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nationality</label>
          <input type="text" value={profile.nationality} onChange={e => setProfile(p => ({ ...p, nationality: e.target.value }))} placeholder="Finnish"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Current City</label>
          <input type="text" value={profile.current_city} onChange={e => setProfile(p => ({ ...p, current_city: e.target.value }))} placeholder="Helsinki"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Current Country</label>
          <input type="text" value={profile.current_country} onChange={e => setProfile(p => ({ ...p, current_country: e.target.value }))} placeholder="Finland"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Moved to City</label>
          <input type="date" value={profile.moved_to_city_date} onChange={e => setProfile(p => ({ ...p, moved_to_city_date: e.target.value }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Moved to Country</label>
          <input type="date" value={profile.moved_to_country_date} onChange={e => setProfile(p => ({ ...p, moved_to_country_date: e.target.value }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 text-gray-900 dark:text-white" />
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        This info helps us send birthday wishes, anniversary reminders, and local travel suggestions. Never shared publicly.
      </p>
    </section>
  );
}
