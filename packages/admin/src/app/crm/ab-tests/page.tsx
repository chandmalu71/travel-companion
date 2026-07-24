'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Variant {
  id: string;
  name: string;
  mode: string;
  content: any;
  traffic_percent: number;
  views: number;
  conversions: number;
}

interface AbTest {
  id: string;
  name: string;
  status: string;
  winner_variant_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  variants: Variant[];
}

export default function AbTestsPage() {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadTests = () => {
    const token = localStorage.getItem('admin_token');
    fetch(`${API_BASE}/api/admin/ab-tests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setTests(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTests(); }, []);

  const handleAction = async (testId: string, action: string, winnerId?: string) => {
    const token = localStorage.getItem('admin_token');
    await fetch(`${API_BASE}/api/admin/ab-tests/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, winner_variant_id: winnerId }),
    });
    loadTests();
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Delete this test and all its data?')) return;
    const token = localStorage.getItem('admin_token');
    await fetch(`${API_BASE}/api/admin/ab-tests/${testId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadTests();
  };

  if (loading) return <p className="text-gray-400 text-center py-12">Loading A/B tests...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Landing Page A/B Tests</h1>
          <p className="text-sm text-gray-400 mt-1">Test different CTA variants to optimize conversion</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          + New Test
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-dashed border-gray-600 p-12 text-center">
          <p className="text-gray-400 mb-2">No A/B tests yet</p>
          <p className="text-xs text-gray-500">Create a test to compare different CTA variants on the landing page</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <div key={test.id} className="bg-gray-800 rounded-lg border border-gray-700 p-5">
              {/* Test header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-white">{test.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    test.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    test.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{test.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {test.status === 'draft' && (
                    <button onClick={() => handleAction(test.id, 'start')} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500">Start Test</button>
                  )}
                  {test.status === 'active' && (
                    <button onClick={() => handleAction(test.id, 'stop')} className="text-xs bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-500">Stop Test</button>
                  )}
                  <button onClick={() => handleDelete(test.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              </div>

              {/* Results table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-2">Variant</th>
                    <th className="pb-2">Mode</th>
                    <th className="pb-2 text-center">Traffic</th>
                    <th className="pb-2 text-center">Views</th>
                    <th className="pb-2 text-center">Conversions</th>
                    <th className="pb-2 text-center">Rate</th>
                    {test.status === 'active' && <th className="pb-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {test.variants.map(v => {
                    const rate = v.views > 0 ? ((v.conversions / v.views) * 100).toFixed(1) : '0.0';
                    const isWinner = test.winner_variant_id === v.id;
                    return (
                      <tr key={v.id} className={`border-b border-gray-700/50 ${isWinner ? 'bg-green-500/5' : ''}`}>
                        <td className="py-2 text-white font-medium">
                          {v.name} {isWinner && <span className="text-green-400 text-xs ml-1">👑 Winner</span>}
                        </td>
                        <td className="py-2 text-gray-400 capitalize">{v.mode.replace('_', ' ')}</td>
                        <td className="py-2 text-center text-gray-300">{v.traffic_percent}%</td>
                        <td className="py-2 text-center text-gray-300">{v.views.toLocaleString()}</td>
                        <td className="py-2 text-center text-gray-300">{v.conversions.toLocaleString()}</td>
                        <td className="py-2 text-center font-medium text-emerald-400">{rate}%</td>
                        {test.status === 'active' && (
                          <td className="py-2 text-center">
                            <button onClick={() => handleAction(test.id, 'declare_winner', v.id)} className="text-xs text-emerald-400 hover:text-emerald-300 underline">
                              Declare Winner
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Metadata */}
              <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
                <span>Created: {new Date(test.created_at).toLocaleDateString()}</span>
                {test.started_at && <span>Started: {new Date(test.started_at).toLocaleDateString()}</span>}
                {test.ended_at && <span>Ended: {new Date(test.ended_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Test Modal */}
      {showCreate && <CreateTestModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadTests(); }} />}
    </div>
  );
}

// ─── Create Test Modal ───────────────────────────────────────────────────────

function CreateTestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [variants, setVariants] = useState([
    { name: 'Control (A)', mode: 'early_access', traffic_percent: 50, content: { headline: 'Ready to Transform Your Travel Experience?', subtitle: 'Join thousands of travelers who plan smarter.' } },
    { name: 'Variant B', mode: 'early_access', traffic_percent: 50, content: { headline: 'Plan Your Next Trip with AI', subtitle: 'Smart travel planning, powered by artificial intelligence.' } },
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalTraffic = variants.reduce((s, v) => s + v.traffic_percent, 0);

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) { setError('Test name required'); return; }
    if (totalTraffic !== 100) { setError(`Traffic must sum to 100% (currently ${totalTraffic}%)`); return; }

    setSaving(true);
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch(`${API_BASE}/api/admin/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), variants }),
      });
      if (res.ok) { onCreated(); } else {
        const d = await res.json();
        setError(d.error || 'Failed to create test');
      }
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  };

  const updateVariant = (idx: number, field: string, value: any) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    if (variants.length >= 5) return;
    setVariants(prev => [...prev, { name: `Variant ${String.fromCharCode(65 + prev.length)}`, mode: 'early_access', traffic_percent: 0, content: { headline: '', subtitle: '' } }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return;
    setVariants(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-gray-800 border border-gray-700 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Create A/B Test</h2>

        {error && <div className="rounded-md bg-red-900/30 border border-red-700 text-red-400 text-sm p-3 mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Test Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Headline test - July 2026"
              className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Variants ({variants.length}/5)</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${totalTraffic === 100 ? 'text-green-400' : 'text-red-400'}`}>Traffic: {totalTraffic}%</span>
                {variants.length < 5 && <button onClick={addVariant} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add Variant</button>}
              </div>
            </div>

            {variants.map((v, idx) => (
              <div key={idx} className="rounded-lg border border-gray-600 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="text" value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)}
                    className="flex-1 rounded border border-gray-600 bg-gray-700 text-white text-sm px-2 py-1" />
                  <select value={v.mode} onChange={e => updateVariant(idx, 'mode', e.target.value)}
                    className="rounded border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1">
                    <option value="early_access">Early Access</option>
                    <option value="sign_up">Sign Up</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={v.traffic_percent}
                      onChange={e => updateVariant(idx, 'traffic_percent', parseInt(e.target.value) || 0)}
                      className="w-14 rounded border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1 text-center" />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  {variants.length > 2 && (
                    <button onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={v.content.headline ?? ''} onChange={e => updateVariant(idx, 'content', { ...v.content, headline: e.target.value })}
                    placeholder="Headline" className="rounded border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1" />
                  <input type="text" value={v.content.subtitle ?? ''} onChange={e => updateVariant(idx, 'content', { ...v.content, subtitle: e.target.value })}
                    placeholder="Subtitle" className="rounded border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
