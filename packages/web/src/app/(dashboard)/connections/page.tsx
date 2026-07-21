'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Connection {
  id: string;
  connectedUserId: string | null;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  status: string;
  label: string | null;
  privacy: string;
  source: string;
  sourceTripId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-700 border-green-200' },
  invited: { label: 'Invited', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-600 border-red-200' },
  blocked: { label: 'Blocked', color: 'bg-gray-200 text-gray-600 border-gray-300' },
};

const LABEL_OPTIONS = [
  'Partner', 'Family', 'Friend', 'Colleague', 'Travel Buddy', 'Guide', 'Other',
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [filter, setFilter] = useState<'all' | 'connected' | 'invited' | 'declined'>('all');

  const loadConnections = () => {
    api.get<{ data: Connection[] }>('/api/connections')
      .then((res) => setConnections(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConnections(); }, []);

  const filtered = filter === 'all' ? connections : connections.filter((c) => c.status === filter);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this connection? They will no longer appear in your suggestions.')) return;
    try {
      await api.delete(`/api/connections/${id}`);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch { /* toast */ }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
          <p className="text-sm text-gray-500 mt-1">People you travel with. Connected users appear as suggestions when inviting to trips.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
        >
          + Add Contact
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['all', 'connected', 'invited', 'declined'] as const).map((f) => {
          const count = f === 'all' ? connections.length : connections.filter((c) => c.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border p-3 text-center transition-all ${
                filter === f ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-lg font-bold text-gray-900">{count}</p>
              <p className="text-[11px] text-gray-500 capitalize">{f}</p>
            </button>
          );
        })}
      </div>

      {/* Connection list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">No connections yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add contacts manually or they'll appear automatically when trip invitations are accepted.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm hover:border-primary-200 transition-all group"
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {connection.avatarUrl ? (
                  <img src={connection.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="text-primary-600 font-bold text-sm">
                    {connection.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingConnection(connection)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm truncate">{connection.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGES[connection.status]?.color ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_BADGES[connection.status]?.label ?? connection.status}
                  </span>
                  {connection.label && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                      {connection.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {connection.email && <p className="text-[11px] text-gray-400 truncate">{connection.email}</p>}
                  {connection.source === 'trip_accept' && <span className="text-[10px] text-gray-400">via trip invite</span>}
                  {connection.source === 'manual' && <span className="text-[10px] text-gray-400">added manually</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingConnection(connection)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(connection.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                  title="Remove"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddConnectionModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); loadConnections(); }}
        />
      )}

      {/* Edit Modal */}
      {editingConnection && (
        <EditConnectionModal
          connection={editingConnection}
          onClose={() => setEditingConnection(null)}
          onSaved={() => { setEditingConnection(null); loadConnections(); }}
        />
      )}
    </div>
  );
}

// ─── Add Connection Modal ────────────────────────────────────────────────────

function AddConnectionModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email && !name) {
      setError('Please enter an email or name');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/connections', {
        email: email || undefined,
        name: name || undefined,
        label: label || undefined,
        notes: notes || undefined,
      });
      onAdded();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? 'Failed to add connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Travel Companion</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            <p className="text-[10px] text-gray-400 mt-1">If they have an account, their profile will be linked automatically.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLabel(label === opt ? '' : opt)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    label === opt
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you know them..."
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Companion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Connection Modal ───────────────────────────────────────────────────

function EditConnectionModal({ connection, onClose, onSaved }: { connection: Connection; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(connection.label ?? '');
  const [privacy, setPrivacy] = useState(connection.privacy);
  const [notes, setNotes] = useState(connection.notes ?? '');
  const [status, setStatus] = useState(connection.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/connections/${connection.id}`, {
        label: label || null,
        privacy,
        notes: notes || null,
        status,
      });
      onSaved();
    } catch {
      alert('Failed to update connection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit Connection</h3>
        <p className="text-sm text-gray-500 mb-4">{connection.name} {connection.email ? `(${connection.email})` : ''}</p>

        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLabel(label === opt ? '' : opt)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    label === opt
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="connected">Connected</option>
              <option value="invited">Invited</option>
              <option value="declined">Declined</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">What they can see about you</label>
            <div className="space-y-1.5">
              {[
                { value: 'full', label: 'Full Profile', desc: 'Name, email, and avatar' },
                { value: 'limited', label: 'Limited', desc: 'Name and avatar only' },
                { value: 'minimal', label: 'Minimal', desc: 'Display name only' },
              ].map((opt) => (
                <label key={opt.value} className={`flex items-center gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${privacy === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="privacy"
                    value={opt.value}
                    checked={privacy === opt.value}
                    onChange={() => setPrivacy(opt.value)}
                    className="text-primary-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-[10px] text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you know them..."
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
