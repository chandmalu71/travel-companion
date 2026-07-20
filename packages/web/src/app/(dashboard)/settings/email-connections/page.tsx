'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailConnection {
  id: string;
  provider: string;
  email: string;
  scanFrequency: string;
  lastScanAt: string | null;
  lastScanStatus: 'success' | 'error' | 'never';
  lastScanError: string | null;
  isActive: boolean;
  tokenValid: boolean;
}

type ConnectStep = 'select-provider' | 'oauth-connect' | 'imap-form' | 'done';

// ─── Provider Config ─────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    color: 'bg-red-50 border-red-200 hover:border-red-400',
    authType: 'oauth' as const,
    description: 'Google Mail (recommended — supports real-time push)',
  },
  {
    id: 'outlook',
    name: 'Outlook / Hotmail',
    icon: '📬',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    authType: 'oauth' as const,
    description: 'Microsoft Outlook, Hotmail, Live.com',
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    icon: '💜',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
    authType: 'oauth' as const,
    description: 'Yahoo Mail accounts',
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    icon: '☁️',
    color: 'bg-gray-50 border-gray-200 hover:border-gray-400',
    authType: 'imap' as const,
    description: 'Apple iCloud email (uses IMAP with app-specific password)',
    imapDefaults: { host: 'imap.mail.me.com', port: 993, tls: true },
  },
  {
    id: 'imap',
    name: 'Other (IMAP/SMTP)',
    icon: '⚙️',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    authType: 'imap' as const,
    description: 'Any email provider with IMAP access (ProtonMail, Fastmail, custom domain, etc.)',
    imapDefaults: { host: '', port: 993, tls: true },
  },
];

const FREQUENCY_OPTIONS = [
  { id: 'realtime', label: 'Real-time (push)', description: 'Instant — Gmail & Outlook only' },
  { id: '5min', label: 'Every 5 minutes', description: 'Recommended' },
  { id: '15min', label: 'Every 15 minutes', description: 'Lower battery/data usage' },
  { id: '1hour', label: 'Every hour', description: 'Minimal scanning' },
  { id: 'manual', label: 'Manual only', description: 'Scan only when you tap "Scan Now"' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmailConnectionsPage() {
  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectStep, setConnectStep] = useState<ConnectStep | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[0] | null>(null);
  const [imapForm, setImapForm] = useState({
    email: '',
    host: '',
    port: 993,
    username: '',
    password: '',
    useTls: true,
  });
  const [scanFrequency, setScanFrequency] = useState('5min');
  const [scanning, setScanning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await api.get<{ data: { connections: EmailConnection[] } }>('/api/email/connections');
      setConnections(res.data?.connections ?? []);
    } catch {}
    setLoading(false);
  }

  function startConnect(provider: typeof PROVIDERS[0]) {
    setSelectedProvider(provider);
    if (provider.authType === 'oauth') {
      setConnectStep('oauth-connect');
    } else {
      setImapForm({
        email: '',
        host: provider.imapDefaults?.host ?? '',
        port: provider.imapDefaults?.port ?? 993,
        username: '',
        password: '',
        useTls: provider.imapDefaults?.tls ?? true,
      });
      setConnectStep('imap-form');
    }
  }

  async function handleOAuthConnect() {
    // OAuth requires provider app credentials (Google/Microsoft/Yahoo)
    // In local dev without credentials configured, show info message
    // In production, this redirects to the OAuth consent page
    const providerName = selectedProvider!.name;

    if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_OAUTH_CONFIGURED) {
      setMessage({
        type: 'error',
        text: `${providerName} OAuth is not configured yet. To connect ${providerName}, the app needs API credentials registered with the provider. See docs/oauth-provider-setup.md for setup instructions. For now, use the IMAP option or forward emails to trips@nayya.ai.`,
      });
      setConnectStep(null);
      return;
    }

    // Production: redirect to OAuth consent URL
    // window.location.href = `/api/auth/oauth/${selectedProvider!.id}/connect?frequency=${scanFrequency}`;
  }

  async function handleImapConnect(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/email/connections', {
        provider: 'imap',
        email: imapForm.email,
        imapHost: imapForm.host,
        imapPort: imapForm.port,
        imapUsername: imapForm.username || imapForm.email,
        imapPassword: imapForm.password,
        imapUseTls: imapForm.useTls,
        scanFrequency,
      });
      setMessage({ type: 'success', text: 'Email connected! Initial scan of last 90 days starting...' });
      setConnectStep(null);
      fetchConnections();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Connection failed' });
    }
  }

  async function handleScanNow(connectionId: string) {
    setScanning(connectionId);
    try {
      const res = await api.post<{ data: { message: string } }>(`/api/email/connections/${connectionId}/scan`);
      setMessage({ type: 'success', text: res.data?.message ?? 'Scan complete' });
      fetchConnections();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Scan failed' });
    }
    setScanning(null);
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Disconnect this email? Previously imported bookings will be kept.')) return;
    try {
      await api.delete(`/api/email/connections/${connectionId}`);
      setMessage({ type: 'success', text: 'Email disconnected. Existing bookings retained.' });
      fetchConnections();
    } catch {}
  }

  async function handleUpdateFrequency(connectionId: string, frequency: string) {
    try {
      await api.put(`/api/email/connections/${connectionId}/frequency`, { frequency });
      fetchConnections();
    } catch {}
  }

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Connections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your email to automatically import booking confirmations into your trips.
          </p>
        </div>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Settings
        </Link>
      </div>

      {/* Status message */}
      {message && (
        <div className={`rounded-md p-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg bg-primary-50 border border-primary-200 p-4">
        <p className="text-sm text-primary-800">
          <strong>How it works:</strong> We scan your inbox for booking confirmation emails from airlines, hotels, and car rentals.
          Only booking details are extracted — we never store your full emails.
        </p>
        <p className="text-xs text-primary-600 mt-2">
          Alternative: Forward bookings directly to <strong>trips@nayya.ai</strong> from any email address.
        </p>
      </div>

      {/* Connected accounts */}
      {connections.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Connected Accounts</h2>
          <div className="space-y-3">
            {connections.map((conn) => (
              <div key={conn.id} className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {PROVIDERS.find((p) => p.id === conn.provider)?.icon ?? '📧'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{conn.email}</p>
                      <p className="text-xs text-gray-500">
                        {PROVIDERS.find((p) => p.id === conn.provider)?.name ?? conn.provider}
                        {' • '}
                        {conn.isActive ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-red-600">Disconnected</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleScanNow(conn.id)}
                      disabled={scanning === conn.id}
                      className="rounded-md bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                    >
                      {scanning === conn.id ? 'Scanning...' : 'Scan Now'}
                    </button>
                    <button
                      onClick={() => handleDisconnect(conn.id)}
                      className="rounded-md bg-gray-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Status & frequency */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    Last scan: {conn.lastScanAt
                      ? new Date(conn.lastScanAt).toLocaleString()
                      : 'Never'}
                    {conn.lastScanStatus === 'error' && (
                      <span className="text-red-500 ml-1" title={conn.lastScanError ?? ''}>⚠️ Error</span>
                    )}
                  </span>
                  <span>•</span>
                  <label className="flex items-center gap-1">
                    Frequency:
                    <select
                      value={conn.scanFrequency}
                      onChange={(e) => handleUpdateFrequency(conn.id, e.target.value)}
                      className="rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {!conn.tokenValid && (
                  <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    ⚠️ Authorization expired. Please reconnect this account.
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connect new account */}
      {!connectStep && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {connections.length > 0 ? 'Connect Another Account' : 'Connect Your Email'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => startConnect(provider)}
                className={`rounded-lg border p-4 text-left transition-all ${provider.color}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{provider.name}</p>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* OAuth connect step */}
      {connectStep === 'oauth-connect' && selectedProvider && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connect {selectedProvider.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            You'll be redirected to {selectedProvider.name} to grant read-only access to your booking emails.
            We only scan for travel confirmations — nothing else.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Scan Frequency</label>
            <select
              value={scanFrequency}
              onChange={(e) => setScanFrequency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>{f.label} — {f.description}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleOAuthConnect}
              className="rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600"
            >
              Connect with {selectedProvider.name}
            </button>
            <button
              onClick={() => setConnectStep(null)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* IMAP form */}
      {connectStep === 'imap-form' && selectedProvider && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connect {selectedProvider.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {selectedProvider.id === 'icloud'
              ? 'Use an app-specific password from appleid.apple.com → Sign-In & Security → App-Specific Passwords.'
              : 'Enter your IMAP server details. Use an app-specific password if your provider supports it.'}
          </p>

          <form onSubmit={handleImapConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                required
                value={imapForm.email}
                onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">IMAP Server</label>
                <input
                  type="text"
                  required
                  value={imapForm.host}
                  onChange={(e) => setImapForm({ ...imapForm, host: e.target.value })}
                  placeholder="imap.example.com"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Port</label>
                <input
                  type="number"
                  value={imapForm.port}
                  onChange={(e) => setImapForm({ ...imapForm, port: parseInt(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Username (if different from email)</label>
              <input
                type="text"
                value={imapForm.username}
                onChange={(e) => setImapForm({ ...imapForm, username: e.target.value })}
                placeholder="Leave blank to use email address"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password / App-Specific Password
              </label>
              <input
                type="password"
                required
                value={imapForm.password}
                onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Stored encrypted. We recommend using an app-specific password.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useTls"
                checked={imapForm.useTls}
                onChange={(e) => setImapForm({ ...imapForm, useTls: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="useTls" className="text-sm text-gray-700">Use TLS/SSL (recommended)</label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scan Frequency</label>
              <select
                value={scanFrequency}
                onChange={(e) => setScanFrequency(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label} — {f.description}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-primary-500 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Connect & Start Scanning
              </button>
              <button
                type="button"
                onClick={() => setConnectStep(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Forwarding alternative */}
      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
        <h3 className="font-medium text-gray-900 mb-2">Alternative: Forward Emails</h3>
        <p className="text-sm text-gray-600 mb-3">
          Don't want to connect your email? Simply forward booking confirmations to:
        </p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-white px-3 py-2 text-sm font-mono border border-gray-200">
            trips@nayya.ai
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText('trips@nayya.ai'); setMessage({ type: 'success', text: 'Copied to clipboard!' }); }}
            className="rounded-md bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          We identify you by your "From" email address and auto-add bookings to matching trips.
        </p>
      </section>
    </div>
  );
}
