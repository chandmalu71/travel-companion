'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  return res.json();
}

interface Option { key: string; name: string; icon: string; enabled: boolean; display_order: number; }

export default function PreferencesConfigPage() {
  const [tab, setTab] = useState<'interests' | 'dietary' | 'allergies'>('interests');
  const [interests, setInterests] = useState<Option[]>([]);
  const [dietary, setDietary] = useState<Option[]>([]);
  const [allergies, setAllergies] = useState<Option[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/preferences/interests').then(r => setInterests(r.data ?? []));
    apiFetch('/api/admin/preferences/dietary').then(r => setDietary(r.data ?? []));
    apiFetch('/api/admin/preferences/allergies').then(r => setAllergies(r.data ?? []));
  }, []);

  const toggle = async (type: string, key: string, enabled: boolean) => {
    await apiFetch(`/api/admin/preferences/${type}/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    if (type === 'interests') setInterests(p => p.map(i => i.key === key ? { ...i, enabled } : i));
    if (type === 'dietary') setDietary(p => p.map(i => i.key === key ? { ...i, enabled } : i));
    if (type === 'allergies') setAllergies(p => p.map(i => i.key === key ? { ...i, enabled } : i));
  };

  const currentItems = tab === 'interests' ? interests : tab === 'dietary' ? dietary : allergies;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Preference Options</h1>
        <span className="text-sm text-gray-400">
          {interests.filter(i => i.enabled).length} interests · {dietary.filter(i => i.enabled).length} dietary · {allergies.filter(i => i.enabled).length} allergies
        </span>
      </div>

      <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
        {(['interests', 'dietary', 'allergies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === t ? 'bg-gray-800 shadow text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'interests' ? '🎯 Interests' : t === 'dietary' ? '🥗 Dietary' : '⚠️ Allergies'}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">Users will see only enabled options in their settings. Disabled options won't appear in dropdown lists.</p>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Icon</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-300">Key</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Order</th>
              <th className="px-4 py-3 text-center font-medium text-gray-300">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {currentItems.map(item => (
              <tr key={item.key} className="hover:bg-gray-700">
                <td className="px-4 py-3 text-lg">{item.icon}</td>
                <td className="px-4 py-3 text-white">{item.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.key}</td>
                <td className="px-4 py-3 text-center text-gray-400">{item.display_order}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggle(tab, item.key, !item.enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.enabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-white" style={{ transform: item.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
