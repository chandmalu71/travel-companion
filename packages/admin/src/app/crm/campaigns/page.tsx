'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_BASE}/api/admin/campaigns`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/email-templates`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([c, t]) => {
      setCampaigns(c.data ?? []);
      setTemplates(t.data ?? []);
    }).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="text-sm text-gray-400 mt-1">Create and manage email campaigns with AI-powered content</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGenerate(true)} className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">
            AI Generate
          </button>
          <button onClick={() => setShowCreate(true)} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + New Campaign
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-2xl font-bold text-white">{campaigns.length}</p>
          <p className="text-xs text-gray-400">Total Campaigns</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-2xl font-bold text-emerald-400">{campaigns.filter(c => c.status === 'sent').length}</p>
          <p className="text-xs text-gray-400">Sent</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-2xl font-bold text-blue-400">{campaigns.filter(c => c.status === 'draft').length}</p>
          <p className="text-xs text-gray-400">Drafts</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-2xl font-bold text-amber-400">{templates.length}</p>
          <p className="text-xs text-gray-400">Templates</p>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : campaigns.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Opens</th>
                <th className="px-4 py-3">Clicks</th>
                <th className="px-4 py-3">Sent</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{c.total_recipients ?? 0}</td>
                  <td className="px-4 py-3 text-gray-300">{c.total_opened ?? 0}</td>
                  <td className="px-4 py-3 text-gray-300">{c.total_clicked ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">No campaigns yet. Create one with AI-generated content.</div>
        )}
      </div>

      {/* AI Generate Modal */}
      {showGenerate && <AIGenerateModal token={token} onClose={() => setShowGenerate(false)} />}

      {/* Create Campaign Modal */}
      {showCreate && <CreateCampaignModal token={token} templates={templates} onClose={() => { setShowCreate(false); }} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    scheduled: 'bg-blue-500/20 text-blue-400',
    sent: 'bg-green-500/20 text-green-400',
    paused: 'bg-amber-500/20 text-amber-400',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}>{status}</span>;
}

function AIGenerateModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('friendly');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!token || !prompt) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/campaigns/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, tone }),
      });
      const data = await res.json();
      setResult(data.data);
    } catch {} finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">AI Email Generator</h3>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">What do you want to communicate?</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g., Welcome new users and encourage them to create their first trip..." className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm h-24 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)} className="rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm">
                <option value="friendly">Friendly & Warm</option>
                <option value="urgent">Urgent & Action-oriented</option>
                <option value="educational">Educational & Informative</option>
                <option value="promotional">Promotional & Value-focused</option>
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generating || !prompt} className="w-full rounded-md bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
              {generating ? 'Generating with AI...' : 'Generate Email Content'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Subject Line</label>
              <input type="text" value={result.subject} readOnly className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Preview Text</label>
              <input type="text" value={result.previewText ?? ''} readOnly className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email Body (HTML)</label>
              <div className="rounded-md border border-gray-600 bg-white p-4 text-gray-900 text-sm max-h-60 overflow-y-auto" dangerouslySetInnerHTML={{ __html: result.body }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResult(null)} className="flex-1 rounded-md border border-gray-600 py-2 text-sm text-gray-300">Regenerate</button>
              <button onClick={onClose} className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white">Save as Template</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCampaignModal({ token, templates, onClose }: { token: string | null; templates: any[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [segment, setSegment] = useState('all_leads');

  const handleCreate = async () => {
    if (!token || !name) return;
    await fetch(`${API_BASE}/api/admin/campaigns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, templateId: templateId || null, segment }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">New Campaign</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Campaign Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Welcome Series - July 2026" className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm">
              <option value="">None (create content later)</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Audience Segment</label>
            <select value={segment} onChange={e => setSegment(e.target.value)} className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm">
              <option value="all_leads">All Leads (marketing consent)</option>
              <option value="new_leads">New Leads Only</option>
              <option value="free_users">Free Users</option>
              <option value="trial_users">Trial Users</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-md border border-gray-600 py-2 text-sm text-gray-300">Cancel</button>
            <button onClick={handleCreate} disabled={!name} className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
