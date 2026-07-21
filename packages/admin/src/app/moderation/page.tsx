'use client';

import { useState } from 'react';

type Tab = 'impersonate' | 'announcements' | 'moderation';

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('announcements');

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'impersonate', label: 'Impersonate User', icon: '👁️' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
    { id: 'moderation', label: 'Content Moderation', icon: '🛡️' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Support & Moderation</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700 w-fit">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'impersonate' && <ImpersonateSection />}
      {activeTab === 'announcements' && <AnnouncementsSection />}
      {activeTab === 'moderation' && <ModerationSection />}
    </div>
  );
}

function ImpersonateSection() {
  const [email, setEmail] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImpersonate = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      // Get an impersonation token from the API
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const adminToken = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/api/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to impersonate user');
        return;
      }

      // Open web app in new tab with the impersonation token
      const token = data.data?.accessToken;
      if (token) {
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';
        // Open new tab with a special URL that sets the token and redirects to dashboard
        const newTab = window.open('about:blank', '_blank');
        if (newTab) {
          newTab.document.write(`
            <html><body><script>
              localStorage.setItem('accessToken', '${token}');
              localStorage.setItem('user', JSON.stringify({ email: '${email}', displayName: '${email.split('@')[0]}' }));
              localStorage.setItem('impersonating', 'true');
              window.location.href = '${webUrl}/dashboard';
            </script><p>Opening user session...</p></body></html>
          `);
        }
        setImpersonating(true);
      } else {
        setError('No token received from server');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
      <h2 className="text-lg font-semibold text-white">User Impersonation</h2>
      <p className="text-sm text-gray-400">Opens the user's dashboard in a new tab. All impersonation actions are logged in the audit trail.</p>

      <div className="flex gap-3">
        <input type="email" placeholder="Enter user email to impersonate..."
          value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleImpersonate()}
          className="flex-1 rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400" />
        <button onClick={handleImpersonate} disabled={loading || !email}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">
          {loading ? 'Opening...' : 'Impersonate →'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {impersonating && (
        <div className="rounded-lg bg-amber-900/30 border border-amber-700 p-4">
          <p className="text-sm text-amber-300">✅ Impersonation session opened for: <strong>{email}</strong></p>
          <p className="text-xs text-amber-400 mt-1">A new tab has been opened with the user's dashboard. Read-only in production.</p>
          <button onClick={() => setImpersonating(false)}
            className="mt-2 text-xs bg-amber-700 px-3 py-1 rounded text-white hover:bg-amber-600">
            Dismiss
          </button>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-4">
        The user's web app opens in a new browser tab. Their session is independent from your admin session.
      </div>
    </section>
  );
}

function AnnouncementsSection() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'maintenance'>('info');

  return (
    <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
      <h2 className="text-lg font-semibold text-white">Send Announcement</h2>
      <p className="text-sm text-gray-400">Send an in-app notification to all active users.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}
            className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white w-48">
            <option value="info">ℹ️ Info (new feature, update)</option>
            <option value="warning">⚠️ Warning</option>
            <option value="maintenance">🔧 Maintenance window</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., New Feature: AI-powered suggestions"
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter the announcement message..."
            rows={4}
            className="w-full rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm text-white placeholder-gray-400 resize-none" />
        </div>

        <div className="flex gap-3">
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">
            Send to All Users
          </button>
          <button className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
            Preview
          </button>
        </div>
      </div>

      {/* Recent announcements */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Recent Announcements</h3>
        <p className="text-xs text-gray-500">No announcements sent yet.</p>
      </div>
    </section>
  );
}

function ModerationSection() {
  const [moderationEnabled, setModerationEnabled] = useState(false);

  return (
    <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Content Moderation</h2>
          <p className="text-sm text-gray-400">Review social media shares before they go live.</p>
        </div>
        <button onClick={() => setModerationEnabled(!moderationEnabled)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            moderationEnabled ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300'
          }`}>
          {moderationEnabled ? '✓ Review Required' : 'Auto-Approve All'}
        </button>
      </div>

      {moderationEnabled ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-300">Pending Review Queue</h3>
          <div className="rounded-lg border border-dashed border-gray-600 p-8 text-center">
            <p className="text-gray-500 text-sm">No items pending review</p>
            <p className="text-xs text-gray-600 mt-1">Social shares will appear here when moderation is active</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-700/30 p-4">
          <p className="text-sm text-gray-400">Moderation is currently <strong className="text-gray-200">disabled</strong>. All social shares are auto-approved.</p>
          <p className="text-xs text-gray-500 mt-1">Enable to require admin review before shares go live.</p>
        </div>
      )}
    </section>
  );
}
