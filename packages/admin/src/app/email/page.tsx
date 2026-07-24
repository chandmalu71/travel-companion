'use client';

import { useEffect, useState } from 'react';

type Tab = 'templates' | 'senders' | 'log';

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Email Management</h1>
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {([['templates', '📧 Templates'], ['senders', '📮 Sender Addresses'], ['log', '📋 Send Log']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'senders' && <SendersTab />}
      {activeTab === 'log' && <LogTab />}
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'system' | 'marketing'>('all');

  useEffect(() => {
    fetch('http://localhost:3000/api/admin/email/templates').then(r => r.json())
      .then(d => setTemplates(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (t: any) => {
    setEditingSlug(t.slug);
    setEditForm({ name: t.name, subject: t.subject, htmlBody: t.html_body, replyTo: t.reply_to ?? '', isActive: t.is_active });
  };

  const saveEdit = async () => {
    if (!editingSlug) return;
    await fetch(`http://localhost:3000/api/admin/email/templates/${editingSlug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingSlug(null);
    const res = await fetch('http://localhost:3000/api/admin/email/templates');
    const d = await res.json();
    setTemplates(d.data ?? []);
  };

  const sendTest = async (slug: string) => {
    if (!testEmail) return;
    const res = await fetch(`http://localhost:3000/api/admin/email/templates/${slug}/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    });
    const d = await res.json();
    setTestResult(d.success ? `Sent to ${testEmail}` : `Failed: ${d.error}`);
    setTimeout(() => setTestResult(''), 3000);
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-700 rounded-lg" />;

  const filteredTemplates = typeFilter === 'all'
    ? templates
    : templates.filter(t => {
        const tType = t.type ?? (t.category === 'transactional' || !t.slug?.startsWith('mkt_') ? 'system' : 'marketing');
        return tType === typeFilter;
      });

  return (
    <div className="space-y-3">
      {/* Type Filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Edit email templates. Use {'{{variable}}'} for dynamic content.</p>
        <div className="flex gap-1 bg-gray-700 rounded-md p-0.5">
          {(['all', 'system', 'marketing'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition ${typeFilter === f ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {f === 'all' ? 'All' : f === 'system' ? '🔒 System' : '📢 Marketing'}
            </button>
          ))}
        </div>
      </div>

      {filteredTemplates.map((t: any) => (
        <div key={t.slug} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">{t.name}</span>
              <code className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{t.slug}</code>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {t.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@email.com" className="rounded bg-gray-900 border border-gray-600 px-2 py-0.5 text-xs text-white w-40" />
              <button onClick={() => sendTest(t.slug)} className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white">Test</button>
              <button onClick={() => startEdit(t)} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white">Edit</button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Subject: {t.subject}</p>
          <p className="text-xs text-gray-600 mt-1">Variables: {(t.variables ?? []).join(', ')}</p>
        </div>
      ))}

      {testResult && <p className="text-xs text-green-400">{testResult}</p>}

      {/* Edit modal */}
      {editingSlug && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setEditingSlug(null)}>
          <div className="bg-gray-800 rounded-xl p-6 w-[700px] max-h-[85vh] overflow-y-auto border border-gray-600 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Edit Template: {editingSlug}</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-400 block mb-1">Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Subject</label><input value={editForm.subject} onChange={e => setEditForm({...editForm, subject: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Reply-To</label><input value={editForm.replyTo} onChange={e => setEditForm({...editForm, replyTo: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-sm text-white" placeholder="support@neyya.ai" /></div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">HTML Body</label>
                <textarea value={editForm.htmlBody} onChange={e => setEditForm({...editForm, htmlBody: e.target.value})} rows={12} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1.5 text-xs text-white font-mono" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} />
                <span className="text-xs text-gray-300">Active</span>
              </div>
            </div>
            {/* Preview */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Preview</label>
              <div className="bg-white rounded p-3 max-h-48 overflow-y-auto" dangerouslySetInnerHTML={{ __html: editForm.htmlBody ?? '' }} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="rounded bg-primary-600 px-4 py-1.5 text-sm text-white hover:bg-primary-500">Save</button>
              <button onClick={() => setEditingSlug(null)} className="rounded bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SendersTab() {
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', purpose: 'transactional' });

  const fetchSenders = () => {
    fetch('http://localhost:3000/api/admin/email/senders').then(r => r.json())
      .then(d => setSenders(d.data ?? []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchSenders(); }, []);

  const createSender = async () => {
    await fetch('http://localhost:3000/api/admin/email/senders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowCreate(false);
    setForm({ email: '', name: '', purpose: 'transactional' });
    fetchSenders();
  };

  const deleteSender = async (id: string) => {
    if (!confirm('Delete this sender address?')) return;
    await fetch(`http://localhost:3000/api/admin/email/senders/${id}`, { method: 'DELETE' });
    fetchSenders();
  };

  if (loading) return <div className="animate-pulse h-32 bg-gray-700 rounded-lg" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Configure sender addresses for different email purposes.</p>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">+ Add Address</button>
      </div>

      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400 block mb-1">Email</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="noreply@neyya.ai" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Display Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="Neyya.ai" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Purpose</label>
              <select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white">
                <option value="transactional">Transactional</option>
                <option value="booking">Booking</option>
                <option value="support">Support</option>
                <option value="marketing">Marketing</option>
                <option value="notifications">Notifications</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createSender} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-500">Add</button>
            <button onClick={() => setShowCreate(false)} className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {senders.map((s: any) => (
        <div key={s.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{s.name}</span>
              <span className="text-xs text-gray-400">&lt;{s.email}&gt;</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{s.purpose}</span>
              {s.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">Default</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.is_verified ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                {s.is_verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
          <button onClick={() => deleteSender(s.id)} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">Delete</button>
        </div>
      ))}
    </div>
  );
}

function LogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/admin/email/log?limit=50').then(r => r.json())
      .then(d => setLogs(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-32 bg-gray-700 rounded-lg" />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">Recent email send history (last 50).</p>
      {logs.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No emails sent yet.</p>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left px-3 py-2 text-gray-400">To</th>
                <th className="text-left px-3 py-2 text-gray-400">Template</th>
                <th className="text-left px-3 py-2 text-gray-400">Subject</th>
                <th className="text-left px-3 py-2 text-gray-400">Status</th>
                <th className="text-left px-3 py-2 text-gray-400">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-700/50">
                  <td className="px-3 py-2 text-white">{l.to_email}</td>
                  <td className="px-3 py-2 text-gray-300">{l.template_slug}</td>
                  <td className="px-3 py-2 text-gray-300 truncate max-w-48">{l.subject}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${l.status === 'sent' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{l.status}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
