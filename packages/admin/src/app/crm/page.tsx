'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface CrmStats {
  totalLeads: number;
  thisWeek: number;
  converted: number;
  conversionRate: number;
  topCountries: Array<{ country: string | null; count: string }>;
  travelStyles: Array<{ travel_style: string | null; count: string }>;
}

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    Promise.all([
      fetch(`${API_BASE}/api/admin/crm/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/api/admin/crm/leads?limit=5`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([statsRes, leadsRes]) => {
      setStats(statsRes.data ?? null);
      setRecentLeads(leadsRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-12">Loading CRM data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">CRM & Lead Management</h1>
        <Link href="/crm/leads" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          View All Leads
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats?.totalLeads ?? 0} icon="🎯" />
        <StatCard label="This Week" value={stats?.thisWeek ?? 0} icon="📈" color="text-emerald-400" />
        <StatCard label="Converted" value={stats?.converted ?? 0} icon="✅" color="text-blue-400" />
        <StatCard label="Conversion Rate" value={`${stats?.conversionRate ?? 0}%`} icon="📊" color="text-amber-400" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top Countries</h3>
          {stats?.topCountries && stats.topCountries.length > 0 ? (
            <div className="space-y-2">
              {stats.topCountries.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-200">{c.country ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">{c.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data yet. Leads will appear here once captured.</p>
          )}
        </div>

        {/* Travel Styles */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Travel Styles</h3>
          {stats?.travelStyles && stats.travelStyles.length > 0 ? (
            <div className="space-y-2">
              {stats.travelStyles.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-200 capitalize">{s.travel_style ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data yet.</p>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Recent Leads</h3>
          <Link href="/crm/leads" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</Link>
        </div>
        {recentLeads.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-700">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Country</th>
                <th className="pb-2">Style</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 text-white">{lead.full_name}</td>
                  <td className="py-2 text-gray-400">{lead.email}</td>
                  <td className="py-2 text-gray-400">{lead.country ?? '—'}</td>
                  <td className="py-2 text-gray-400 capitalize">{lead.travel_style ?? '—'}</td>
                  <td className="py-2"><LeadStatusBadge status={lead.status} /></td>
                  <td className="py-2 text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No leads captured yet. Add the lead capture form to your landing page.</p>
        )}
      </div>

      {/* Landing Page CTA Mode */}
      <LandingCtaModeToggle />

      {/* Quick Setup Guide */}
      <div className="bg-gray-800/50 rounded-lg border border-dashed border-gray-600 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Setup Checklist</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" className="rounded" defaultChecked disabled /> Lead capture form on landing page
          </label>
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" className="rounded" defaultChecked disabled /> Legal pages (Privacy, Terms, Cookies)
          </label>
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" className="rounded" disabled /> Cookie consent banner
          </label>
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" className="rounded" disabled /> Welcome email series configured
          </label>
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" className="rounded" disabled /> reCAPTCHA v3 configured
          </label>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function LeadStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400',
    contacted: 'bg-amber-500/20 text-amber-400',
    converted: 'bg-green-500/20 text-green-400',
    unsubscribed: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {status}
    </span>
  );
}


function LandingCtaModeToggle() {
  const [mode, setMode] = useState<string>('early_access');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [content, setContent] = useState({
    early_access: {
      headline: 'Ready to Transform Your Travel Experience?',
      subtitle: 'Join thousands of travelers who plan smarter, not harder. Get early access and exclusive launch offers.',
      badges: ['Free to join', 'No spam', 'Unsubscribe anytime'],
    },
    sign_up: {
      headline: 'Ready to Transform Your Travel Experience?',
      subtitle: 'Join thousands of travelers who plan smarter, not harder.',
      buttonText: 'Create Your Free Account',
      subtext: 'Free plan includes 3 trips. No credit card required.',
    },
  });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`${API_BASE}/api/admin/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.data?.landingPage?.ctaMode) setMode(d.data.landingPage.ctaMode);
        if (d.data?.landingPage?.content) {
          setContent(prev => ({ ...prev, ...d.data.landingPage.content }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(`${API_BASE}/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ landingCtaMode: mode, landingCtaContent: content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  const currentContent = mode === 'early_access' ? content.early_access : content.sign_up;

  return (
    <div className="bg-gray-800 dark:bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-300">Landing Page CTA</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure the call-to-action section visitors see on the landing page</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400">✓ Saved</span>}
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('early_access')}
          className={`rounded-lg border p-3 text-left transition-all ${
            mode === 'early_access' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <p className={`text-sm font-medium ${mode === 'early_access' ? 'text-emerald-400' : 'text-gray-300'}`}>📧 Early Access</p>
          <p className="text-xs text-gray-500 mt-1">Email capture form + waitlist</p>
        </button>
        <button
          onClick={() => setMode('sign_up')}
          className={`rounded-lg border p-3 text-left transition-all ${
            mode === 'sign_up' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <p className={`text-sm font-medium ${mode === 'sign_up' ? 'text-emerald-400' : 'text-gray-300'}`}>🚀 Sign Up</p>
          <p className="text-xs text-gray-500 mt-1">Direct registration button</p>
        </button>
      </div>

      {/* Content Editor */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Headline</label>
          <input
            type="text"
            value={currentContent.headline}
            onChange={(e) => setContent(prev => ({
              ...prev,
              [mode]: { ...prev[mode as keyof typeof prev], headline: e.target.value },
            }))}
            className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Subtitle</label>
          <textarea
            value={currentContent.subtitle}
            onChange={(e) => setContent(prev => ({
              ...prev,
              [mode]: { ...prev[mode as keyof typeof prev], subtitle: e.target.value },
            }))}
            rows={2}
            className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        {mode === 'early_access' && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Trust Badges (comma-separated)</label>
            <input
              type="text"
              value={(content.early_access.badges ?? []).join(', ')}
              onChange={(e) => setContent(prev => ({
                ...prev,
                early_access: { ...prev.early_access, badges: e.target.value.split(',').map(b => b.trim()).filter(Boolean) },
              }))}
              className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {mode === 'sign_up' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Button Text</label>
              <input
                type="text"
                value={content.sign_up.buttonText}
                onChange={(e) => setContent(prev => ({
                  ...prev,
                  sign_up: { ...prev.sign_up, buttonText: e.target.value },
                }))}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sub-text (below button)</label>
              <input
                type="text"
                value={content.sign_up.subtext}
                onChange={(e) => setContent(prev => ({
                  ...prev,
                  sign_up: { ...prev.sign_up, subtext: e.target.value },
                }))}
                className="w-full rounded-md border border-gray-600 bg-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Live Preview */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2">Live Preview</p>
        <div className="rounded-lg border border-gray-600 bg-white p-6 overflow-hidden">
          {mode === 'early_access' ? (
            <div className="grid grid-cols-2 gap-6 items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">{content.early_access.headline}</h2>
                <p className="text-xs text-gray-600 mb-3">{content.early_access.subtitle}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                  {(content.early_access.badges ?? []).map((b, i) => (
                    <span key={i} className="flex items-center gap-0.5">✓ {b}</span>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-gray-700 mb-2">Get Early Access</p>
                <div className="h-7 bg-gray-200 rounded-md mb-2" />
                <div className="h-7 bg-gray-200 rounded-md mb-2" />
                <div className="h-7 bg-emerald-500 rounded-md flex items-center justify-center">
                  <span className="text-[10px] text-white font-medium">Join the Waitlist</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <h2 className="text-lg font-bold text-gray-900 mb-2">{content.sign_up.headline}</h2>
              <p className="text-xs text-gray-600 mb-4">{content.sign_up.subtitle}</p>
              <div className="inline-block bg-emerald-500 text-white text-xs font-semibold px-6 py-2 rounded-lg">
                {content.sign_up.buttonText}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{content.sign_up.subtext}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
