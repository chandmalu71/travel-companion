'use client';

import { useEffect, useState } from 'react';

interface Language { code: string; name: string; native_name: string; enabled: boolean; rtl: boolean; translation_coverage: number; auto_translated: boolean; }
interface Currency { code: string; name: string; symbol: string; decimal_places: number; enabled: boolean; display_order: number; }
interface Locale { code: string; name: string; language_code: string; date_format: string; time_format: string; number_format: string; default_currency: string; units: string; enabled: boolean; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  return res.json();
}

export default function I18nPage() {
  const [tab, setTab] = useState<'languages' | 'currencies' | 'locales'>('languages');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [locales, setLocales] = useState<Locale[]>([]);
  const [searchCurrency, setSearchCurrency] = useState('');

  useEffect(() => {
    apiFetch('/api/admin/i18n/languages').then(r => setLanguages(r.data ?? []));
    apiFetch('/api/admin/i18n/currencies').then(r => setCurrencies(r.data ?? []));
    apiFetch('/api/admin/i18n/locales').then(r => setLocales(r.data ?? []));
  }, []);

  const toggleLanguage = async (code: string, enabled: boolean) => {
    await apiFetch(`/api/admin/i18n/languages/${code}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    setLanguages(prev => prev.map(l => l.code === code ? { ...l, enabled } : l));
  };

  const toggleCurrency = async (code: string, enabled: boolean) => {
    await apiFetch(`/api/admin/i18n/currencies/${code}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    setCurrencies(prev => prev.map(c => c.code === code ? { ...c, enabled } : c));
  };

  const toggleLocale = async (code: string, enabled: boolean) => {
    await apiFetch(`/api/admin/i18n/locales/${code}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    setLocales(prev => prev.map(l => l.code === code ? { ...l, enabled } : l));
  };

  const filteredCurrencies = searchCurrency
    ? currencies.filter(c => c.code.toLowerCase().includes(searchCurrency.toLowerCase()) || c.name.toLowerCase().includes(searchCurrency.toLowerCase()))
    : currencies;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Internationalization</h1>
        <div className="text-sm text-gray-500">
          {languages.filter(l => l.enabled).length} languages · {currencies.filter(c => c.enabled).length} currencies · {locales.filter(l => l.enabled).length} locales
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['languages', 'currencies', 'locales'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'languages' ? '🌐 Languages' : t === 'currencies' ? '💰 Currencies' : '📍 Locales'}
          </button>
        ))}
      </div>

      {/* Languages Tab */}
      {tab === 'languages' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Language</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Native</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">RTL</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Coverage</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {languages.map(lang => (
                <tr key={lang.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{lang.name}</td>
                  <td className="px-4 py-3 text-gray-500">{lang.native_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{lang.code}</td>
                  <td className="px-4 py-3 text-center">{lang.rtl ? '↙️' : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${lang.translation_coverage}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{lang.translation_coverage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleLanguage(lang.code, !lang.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lang.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${lang.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: lang.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Currencies Tab */}
      {tab === 'currencies' && (
        <div>
          <div className="mb-3">
            <input type="text" placeholder="Search currencies..." value={searchCurrency} onChange={e => setSearchCurrency(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Symbol</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Decimals</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Order</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCurrencies.map(curr => (
                  <tr key={curr.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-xs">{curr.code}</td>
                    <td className="px-4 py-3">{curr.name}</td>
                    <td className="px-4 py-3 text-center text-lg">{curr.symbol}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{curr.decimal_places}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{curr.display_order}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleCurrency(curr.code, !curr.enabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${curr.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white" style={{ transform: curr.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Locales Tab */}
      {tab === 'locales' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Locale</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Language</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Numbers</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Currency</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Units</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {locales.map(loc => (
                <tr key={loc.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div><span className="font-medium">{loc.name}</span></div>
                    <div className="text-xs text-gray-400 font-mono">{loc.code}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{loc.language_code}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{loc.date_format}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{loc.time_format}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{loc.number_format}</td>
                  <td className="px-4 py-3 font-mono text-xs">{loc.default_currency}</td>
                  <td className="px-4 py-3 text-center text-xs">{loc.units}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleLocale(loc.code, !loc.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${loc.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className="inline-block h-3.5 w-3.5 rounded-full bg-white" style={{ transform: loc.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
