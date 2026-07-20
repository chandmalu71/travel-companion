'use client';

import { useEffect, useState } from 'react';

interface TranslationEntry { id: string; key: string; namespace: string; englishText: string; translation: string | null; isAuto: boolean; isReviewed: boolean; }
interface Language { code: string; name: string; native_name: string; enabled: boolean; translation_coverage: number; auto_translated: boolean; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  return res.json();
}

export default function TranslationsPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [search, setSearch] = useState('');
  const [nsFilter, setNsFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    apiFetch('/api/admin/i18n/languages').then(r => setLanguages((r.data ?? []).filter((l: Language) => l.code !== 'en')));
  }, []);

  useEffect(() => {
    if (!selectedLang) return;
    setLoading(true);
    apiFetch(`/api/admin/i18n/translations/${selectedLang}`)
      .then(r => setEntries(r.data ?? []))
      .finally(() => setLoading(false));
  }, [selectedLang]);

  const handleAutoTranslate = async () => {
    if (!selectedLang) return;
    setTranslating(true);
    await apiFetch(`/api/admin/i18n/languages/${selectedLang}/auto-translate`, { method: 'POST' });
    // Reload translations
    const r = await apiFetch(`/api/admin/i18n/translations/${selectedLang}`);
    setEntries(r.data ?? []);
    // Refresh language list
    const lr = await apiFetch('/api/admin/i18n/languages');
    setLanguages((lr.data ?? []).filter((l: Language) => l.code !== 'en'));
    setTranslating(false);
  };

  const handleSave = async (keyId: string) => {
    await apiFetch(`/api/admin/i18n/translations/${selectedLang}/${keyId}`, { method: 'PUT', body: JSON.stringify({ text: editText }) });
    setEntries(prev => prev.map(e => e.id === keyId ? { ...e, translation: editText, isAuto: false, isReviewed: true } : e));
    setEditingId(null);
  };

  const namespaces = [...new Set(entries.map(e => e.namespace))];
  const filtered = entries.filter(e => {
    if (nsFilter && e.namespace !== nsFilter) return false;
    if (search && !e.key.includes(search) && !e.englishText.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const translated = entries.filter(e => e.translation).length;
  const coverage = entries.length > 0 ? Math.round((translated / entries.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Translation Editor</h1>
      </div>

      {/* Language selector + actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select language...</option>
          {languages.map(l => <option key={l.code} value={l.code}>{l.native_name} ({l.name}) — {l.translation_coverage}%</option>)}
        </select>

        {selectedLang && (
          <>
            <button onClick={handleAutoTranslate} disabled={translating}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
              {translating ? '🔄 Translating...' : '🤖 Auto-Translate All'}
            </button>
            <span className="text-sm text-gray-400">{translated}/{entries.length} translated ({coverage}%)</span>
          </>
        )}
      </div>

      {/* Filters */}
      {selectedLang && (
        <div className="flex gap-3">
          <input type="text" placeholder="Search keys or text..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select value={nsFilter} onChange={e => setNsFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">All namespaces</option>
            {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
          </select>
        </div>
      )}

      {/* Translation table */}
      {loading ? (
        <div className="animate-pulse space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-200 rounded" />)}</div>
      ) : selectedLang && filtered.length > 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-300 w-48">Key</th>
                <th className="px-3 py-2 text-left font-medium text-gray-300">English</th>
                <th className="px-3 py-2 text-left font-medium text-gray-300">Translation</th>
                <th className="px-3 py-2 text-center font-medium text-gray-300 w-20">Status</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-900">
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] text-gray-400 block truncate">{entry.key}</span>
                    <span className="text-[10px] text-gray-300">{entry.namespace}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-200 text-xs">{entry.englishText}</td>
                  <td className="px-3 py-2">
                    {editingId === entry.id ? (
                      <div className="flex gap-1">
                        <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                          className="flex-1 rounded border border-blue-300 px-2 py-1 text-xs" autoFocus />
                        <button onClick={() => handleSave(entry.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 px-1">✕</button>
                      </div>
                    ) : (
                      <span className={`text-xs ${entry.translation ? (entry.isAuto ? 'text-purple-600 italic' : 'text-white') : 'text-red-400'}`}>
                        {entry.translation ?? '— not translated —'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.isReviewed && <span className="text-green-500 text-xs">✓</span>}
                    {entry.isAuto && !entry.isReviewed && <span className="text-purple-400 text-xs">🤖</span>}
                    {!entry.translation && <span className="text-red-300 text-xs">✗</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => { setEditingId(entry.id); setEditText(entry.translation ?? entry.englishText); }}
                      className="text-xs text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedLang ? (
        <p className="text-gray-400 text-sm">No matching keys found.</p>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-2xl mb-2">🌐</p>
          <p className="text-gray-400">Select a language to view and edit translations.</p>
        </div>
      )}
    </div>
  );
}
