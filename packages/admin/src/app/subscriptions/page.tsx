'use client';

import { useState, useEffect } from 'react';

// Plans data (in production: fetched from API)
const PLANS = [
  { slug: 'free', name: 'Free', tier: 0, monthlyEur: 0, annualEur: 0, familyMonthly: null, familyAnnual: null, maxTrips: 3, maxExpenses: 20, maxStorage: 100, maxNetwork: 20, maxFamily: 3, maxAliases: 1, weather: 3 },
  { slug: 'pro', name: 'Pro', tier: 1, monthlyEur: 14.99, annualEur: 149.99, familyMonthly: 24.99, familyAnnual: 249.99, maxTrips: null, maxExpenses: null, maxStorage: 5120, maxNetwork: 200, maxFamily: 10, maxAliases: 5, weather: 14 },
  { slug: 'premium', name: 'Premium', tier: 2, monthlyEur: 29.99, annualEur: 299.99, familyMonthly: 44.99, familyAnnual: 449.99, maxTrips: null, maxExpenses: null, maxStorage: 25600, maxNetwork: 500, maxFamily: 20, maxAliases: 15, weather: 14 },
];

type Tab = 'plans' | 'promotions' | 'campaigns' | 'users' | 'settings';

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Subscriptions & Billing</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {([['plans', '💎 Plans'], ['promotions', '🔥 Promotions'], ['campaigns', '🏷️ Campaigns'], ['users', '👤 User Overrides'], ['settings', '⚙️ Settings']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'promotions' && <PromotionsTab />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'users' && <UserOverridesTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/plans').then(r => r.json())
      .then(d => setPlans(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (plan: any) => {
    setEditing(plan.slug);
    setEditValues({
      monthlyEur: plan.price_monthly_eur, annualEur: plan.price_annual_eur,
      maxTrips: plan.max_active_trips, maxStorage: plan.max_storage_mb,
      maxNetwork: plan.max_network_connections, maxFamily: plan.max_family_members,
      maxAliases: plan.max_email_aliases, weather: plan.weather_days,
      maxExpenses: plan.max_expenses_per_month, maxMessages: plan.max_messages_per_day,
      maxAiTips: plan.max_ai_tips_per_trip, maxAiChat: plan.max_ai_chat_per_day,
    });
  };

  const saveEdit = async (slug: string) => {
    await fetch(`http://localhost:3000/api/admin/plans/${slug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceMonthlyEur: parseFloat(editValues.monthlyEur) || 0,
        priceAnnualEur: parseFloat(editValues.annualEur) || 0,
        maxActiveTrips: parseInt(editValues.maxTrips) || null,
        maxStorageMb: parseInt(editValues.maxStorage) || null,
        maxNetworkConnections: parseInt(editValues.maxNetwork) || null,
        maxFamilyMembers: parseInt(editValues.maxFamily) || null,
        maxEmailAliases: parseInt(editValues.maxAliases) || null,
        weatherDays: parseInt(editValues.weather) || 3,
        maxExpensesPerMonth: parseInt(editValues.maxExpenses) || null,
        maxMessagesPerDay: parseInt(editValues.maxMessages) || null,
        maxAiTipsPerTrip: parseInt(editValues.maxAiTips) || null,
        maxAiChatPerDay: parseInt(editValues.maxAiChat) || null,
      }),
    });
    // Refresh plans
    const res = await fetch('http://localhost:3000/api/plans');
    const d = await res.json();
    setPlans(d.data ?? []);
    setEditing(null);
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-700 rounded-lg" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Configure plan pricing and feature limits. Changes apply immediately.</p>

      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan: any) => (
          <div key={plan.slug} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
            <p className="text-2xl font-bold text-primary-400 mb-4">
              {Number(plan.price_monthly_eur) === 0 ? 'Free' : `€${Number(plan.price_monthly_eur).toFixed(2)}/mo`}
            </p>

            {editing === plan.slug ? (
              <div className="space-y-2 text-xs">
                <div><label className="text-gray-400">Monthly (€)</label><input type="number" step="0.01" value={editValues.monthlyEur} onChange={e => setEditValues({...editValues, monthlyEur: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Annual (€)</label><input type="number" step="0.01" value={editValues.annualEur} onChange={e => setEditValues({...editValues, annualEur: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Trips</label><input type="number" value={editValues.maxTrips ?? ''} onChange={e => setEditValues({...editValues, maxTrips: e.target.value})} placeholder="∞" className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Storage (MB)</label><input type="number" value={editValues.maxStorage} onChange={e => setEditValues({...editValues, maxStorage: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Network</label><input type="number" value={editValues.maxNetwork} onChange={e => setEditValues({...editValues, maxNetwork: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Family</label><input type="number" value={editValues.maxFamily} onChange={e => setEditValues({...editValues, maxFamily: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Aliases</label><input type="number" value={editValues.maxAliases} onChange={e => setEditValues({...editValues, maxAliases: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Weather (days)</label><input type="number" value={editValues.weather} onChange={e => setEditValues({...editValues, weather: e.target.value})} className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Expenses/month</label><input type="number" value={editValues.maxExpenses ?? ''} onChange={e => setEditValues({...editValues, maxExpenses: e.target.value})} placeholder="∞" className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max Messages/day</label><input type="number" value={editValues.maxMessages ?? ''} onChange={e => setEditValues({...editValues, maxMessages: e.target.value})} placeholder="∞" className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max AI Tips/trip</label><input type="number" value={editValues.maxAiTips ?? ''} onChange={e => setEditValues({...editValues, maxAiTips: e.target.value})} placeholder="∞" className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div><label className="text-gray-400">Max AI Chat/day</label><input type="number" value={editValues.maxAiChat ?? ''} onChange={e => setEditValues({...editValues, maxAiChat: e.target.value})} placeholder="∞" className="w-full mt-0.5 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white" /></div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => saveEdit(plan.slug)} className="flex-1 rounded bg-primary-600 px-2 py-1 text-white hover:bg-primary-500">Save</button>
                  <button onClick={() => setEditing(null)} className="flex-1 rounded bg-gray-700 px-2 py-1 text-white hover:bg-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Annual</span><span className="text-white">€{Number(plan.price_annual_eur).toFixed(2)}/yr</span></div>
                  {plan.price_monthly_family_eur && <div className="flex justify-between"><span className="text-gray-400">Family (monthly)</span><span className="text-white">€{Number(plan.price_monthly_family_eur).toFixed(2)}/mo</span></div>}
                  {plan.price_annual_family_eur && <div className="flex justify-between"><span className="text-gray-400">Family (annual)</span><span className="text-white">€{Number(plan.price_annual_family_eur).toFixed(2)}/yr</span></div>}
                  <hr className="border-gray-700 my-2" />
                  <div className="flex justify-between"><span className="text-gray-400">Active Trips</span><span className="text-white">{plan.max_active_trips ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Expenses/mo</span><span className="text-white">{plan.max_expenses_per_month ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Storage</span><span className="text-white">{plan.max_storage_mb >= 1024 ? `${(plan.max_storage_mb / 1024).toFixed(0)}GB` : `${plan.max_storage_mb}MB`}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Network</span><span className="text-white">{plan.max_network_connections ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Family</span><span className="text-white">{plan.max_family_members ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Aliases</span><span className="text-white">{plan.max_email_aliases ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Weather</span><span className="text-white">{plan.weather_days}-day</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Messages/day</span><span className="text-white">{plan.max_messages_per_day ?? '∞'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">AI Tips/trip</span><span className="text-white">{plan.max_ai_tips_per_trip ?? '∞'}</span></div>
                </div>

                <button onClick={() => startEdit(plan)} className="mt-4 w-full rounded-md bg-gray-700 px-3 py-1.5 text-xs text-white hover:bg-gray-600">
                  Edit Plan
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromotionsTab() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [form, setForm] = useState({ name: '', discountPercent: 50, appliesTo: 'pro,premium', billingCycles: 'monthly,annual', startsAt: '', endsAt: '', badgeText: '', eventType: 'general', themeColor: '#ef4444', bannerEmoji: '', bannerText: '' });

  const fetchPromos = () => {
    fetch('http://localhost:3000/api/admin/promotions').then(r => r.json())
      .then(d => setPromos(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPromos(); }, []);

  const createPromo = async () => {
    await fetch('http://localhost:3000/api/admin/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        discountPercent: form.discountPercent,
        appliesTo: form.appliesTo.split(',').map(s => s.trim()),
        billingCycles: form.billingCycles.split(',').map(s => s.trim()),
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        badgeText: form.badgeText || `🔥 ${form.discountPercent}% OFF`,
        eventType: form.eventType,
        themeColor: form.themeColor,
        bannerEmoji: form.bannerEmoji,
        bannerText: form.bannerText,
      }),
    });
    setShowCreate(false);
    fetchPromos();
  };

  const toggleActive = async (promo: any) => {
    await fetch(`http://localhost:3000/api/admin/promotions/${promo.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !promo.is_active }),
    });
    fetchPromos();
  };

  const deletePromo = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    await fetch(`http://localhost:3000/api/admin/promotions/${id}`, { method: 'DELETE' });
    fetchPromos();
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name, discountPercent: p.discount_percent,
      startsAt: p.starts_at?.split('T')[0] ?? '', endsAt: p.ends_at?.split('T')[0] ?? '',
      badgeText: p.badge_text ?? '', eventType: p.event_type ?? 'general',
      themeColor: p.theme_color ?? '#ef4444', bannerEmoji: p.banner_emoji ?? '', bannerText: p.banner_text ?? '',
      appliesTo: (p.applies_to ?? []).join(','),
    });
  };

  const saveEdit = async (id: string) => {
    await fetch(`http://localhost:3000/api/admin/promotions/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name, discountPercent: editForm.discountPercent,
        startsAt: editForm.startsAt, endsAt: editForm.endsAt,
        badgeText: editForm.badgeText, eventType: editForm.eventType,
        themeColor: editForm.themeColor, bannerEmoji: editForm.bannerEmoji, bannerText: editForm.bannerText,
        appliesTo: editForm.appliesTo?.split(',').map((s: string) => s.trim()),
      }),
    });
    setEditingId(null);
    fetchPromos();
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-700 rounded-lg" />;

  // Timeline computation: 12 months from current month
  const now = new Date();
  const months: { label: string; start: Date; end: Date }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    months.push({ label: d.toLocaleString('en', { month: 'short', year: '2-digit' }), start: d, end });
  }
  const timelineStart = months[0].start.getTime();
  const timelineEnd = months[11].end.getTime();
  const totalDuration = timelineEnd - timelineStart;
  const getBarStyle = (p: any) => {
    const s = Math.max(new Date(p.starts_at).getTime(), timelineStart);
    const e = Math.min(new Date(p.ends_at).getTime(), timelineEnd);
    if (e < timelineStart || s > timelineEnd) return null;
    const left = ((s - timelineStart) / totalDuration) * 100;
    const width = ((e - s) / totalDuration) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400">Manage scheduled and active promotions.</p>
          <div className="flex bg-gray-800 rounded-md p-0.5 border border-gray-700">
            <button onClick={() => setView('timeline')} className={`px-2 py-0.5 text-xs rounded ${view === 'timeline' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>📅 Timeline</button>
            <button onClick={() => setView('list')} className={`px-2 py-0.5 text-xs rounded ${view === 'list' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>📋 List</button>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">
          + New Promotion
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="Summer Sale" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Discount %</label>
              <input type="number" value={form.discountPercent} onChange={e => setForm({...form, discountPercent: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Date</label>
              <input type="date" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">End Date</label>
              <input type="date" value={form.endsAt} onChange={e => setForm({...form, endsAt: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Applies To (comma-sep plans)</label>
              <input value={form.appliesTo} onChange={e => setForm({...form, appliesTo: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="pro,premium" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Badge Text (shown on card)</label>
              <input value={form.badgeText} onChange={e => setForm({...form, badgeText: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="🔥 50% OFF" />
            </div>
          </div>
          {/* Event-specific fields */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Event Type</label>
              <select value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white">
                <option value="general">General</option>
                <option value="summer">Summer</option>
                <option value="christmas">Christmas</option>
                <option value="black_friday">Black Friday</option>
                <option value="new_year">New Year</option>
                <option value="easter">Easter</option>
                <option value="valentines">Valentine's</option>
                <option value="back_to_school">Back to School</option>
                <option value="flash_sale">Flash Sale</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Theme Color</label>
              <input type="color" value={form.themeColor} onChange={e => setForm({...form, themeColor: e.target.value})} className="w-full h-7 rounded bg-gray-900 border border-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Banner Emoji</label>
              <input value={form.bannerEmoji} onChange={e => setForm({...form, bannerEmoji: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="☀️ 🎄 ⚡" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Banner Text (pricing page)</label>
              <input value={form.bannerText} onChange={e => setForm({...form, bannerText: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="Summer Sale — 50% off!" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={createPromo} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-500">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No promotions yet. Create one to display discounted prices.</p>
      ) : view === 'timeline' ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          {/* Month headers */}
          <div className="flex border-b border-gray-700 pb-2 mb-2">
            <div className="w-36 shrink-0 text-xs text-gray-500">Event</div>
            <div className="flex-1 flex">
              {months.map((m, i) => <div key={i} className="flex-1 text-center text-[10px] text-gray-500">{m.label}</div>)}
            </div>
            <div className="w-20 shrink-0" />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40 inline-block" /> Today</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Scheduled</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Paused</span>
          </div>
          {/* Promo rows */}
          {promos.map((p: any) => {
            const barStyle = getBarStyle(p);
            const isExpired = new Date(p.ends_at) < new Date();
            let barColor = p.theme_color ?? '#ef4444';
            let opacity = '1';
            if (!p.is_active) { barColor = '#6b7280'; opacity = '0.5'; }
            else if (isExpired) { barColor = '#6b7280'; opacity = '0.4'; }
            return (
              <div key={p.id} className="flex items-center mb-2 group">
                <div className="w-36 shrink-0 flex items-center gap-1 pr-2">
                  <span className="text-[11px] text-white truncate">{p.banner_emoji ?? ''} {p.name}</span>
                  <span className="text-[10px] text-gray-500">{p.discount_percent}%</span>
                </div>
                <div className="flex-1 relative h-7 bg-gray-900/50 rounded">
                  {/* Today line */}
                  <div className="absolute top-0 bottom-0 w-px bg-white/30 z-10" style={{ left: `${((now.getTime() - timelineStart) / totalDuration) * 100}%` }} />
                  {barStyle && (
                    <div className="absolute top-1 bottom-1 rounded cursor-pointer transition-all hover:brightness-125 flex items-center justify-center"
                      style={{ ...barStyle, backgroundColor: barColor, opacity }}
                      onClick={() => startEdit(p)}
                      title={`${p.name}: ${new Date(p.starts_at).toLocaleDateString()} → ${new Date(p.ends_at).toLocaleDateString()}`}>
                      <span className="text-[10px] text-white font-medium px-1 truncate">{p.badge_text}</span>
                    </div>
                  )}
                </div>
                <div className="w-20 shrink-0 flex items-center justify-end gap-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleActive(p)} title={p.is_active ? 'Pause' : 'Activate'} className={`text-xs px-1 py-0.5 rounded ${p.is_active ? 'bg-yellow-600' : 'bg-green-600'} text-white`}>{p.is_active ? '⏸' : '▶'}</button>
                  <button onClick={() => startEdit(p)} title="Edit" className="text-xs px-1 py-0.5 rounded bg-blue-600 text-white">✎</button>
                  <button onClick={() => deletePromo(p.id)} title="Delete" className="text-xs px-1 py-0.5 rounded bg-red-600 text-white">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((p: any) => {
            const isExpired = new Date(p.ends_at) < new Date();
            return (
              <div key={p.id} className={`bg-gray-800 rounded-lg p-4 border ${p.is_active && !isExpired ? 'border-green-700' : 'border-gray-700'} flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{p.name}</span>
                    <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded">{p.discount_percent}% OFF</span>
                    {p.event_type && p.event_type !== 'general' && <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded">{p.event_type.replace('_', ' ')}</span>}
                    {p.is_active && !isExpired && new Date(p.starts_at) <= new Date() && <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded">Active</span>}
                    {isExpired && <span className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded">Expired</span>}
                    {!p.is_active && !isExpired && <span className="bg-yellow-900/30 text-yellow-400 text-xs px-2 py-0.5 rounded">Paused</span>}
                    {!isExpired && new Date(p.starts_at) > new Date() && p.is_active && <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded">Scheduled</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(p.starts_at).toLocaleDateString()} → {new Date(p.ends_at).toLocaleDateString()} · Plans: {p.applies_to?.join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white">Edit</button>
                  <button onClick={() => toggleActive(p)} className={`text-xs px-2 py-1 rounded ${p.is_active ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white`}>{p.is_active ? 'Pause' : 'Activate'}</button>
                  <button onClick={() => deletePromo(p.id)} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setEditingId(null)}>
          <div className="bg-gray-800 rounded-xl p-6 w-[560px] border border-gray-600 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Edit Promotion</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Discount %</label><input type="number" value={editForm.discountPercent} onChange={e => setEditForm({...editForm, discountPercent: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Start Date</label><input type="date" value={editForm.startsAt} onChange={e => setEditForm({...editForm, startsAt: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">End Date</label><input type="date" value={editForm.endsAt} onChange={e => setEditForm({...editForm, endsAt: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Applies To</label><input value={editForm.appliesTo} onChange={e => setEditForm({...editForm, appliesTo: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Badge Text</label><input value={editForm.badgeText} onChange={e => setEditForm({...editForm, badgeText: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Event Type</label>
                <select value={editForm.eventType} onChange={e => setEditForm({...editForm, eventType: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white">
                  <option value="general">General</option><option value="summer">Summer</option><option value="christmas">Christmas</option><option value="black_friday">Black Friday</option><option value="new_year">New Year</option><option value="easter">Easter</option><option value="flash_sale">Flash Sale</option>
                </select>
              </div>
              <div><label className="text-xs text-gray-400 block mb-1">Theme Color</label><input type="color" value={editForm.themeColor} onChange={e => setEditForm({...editForm, themeColor: e.target.value})} className="w-full h-7 rounded bg-gray-900 border border-gray-600" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Banner Emoji</label><input value={editForm.bannerEmoji} onChange={e => setEditForm({...editForm, bannerEmoji: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Banner Text</label><input value={editForm.bannerText} onChange={e => setEditForm({...editForm, bannerText: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => saveEdit(editingId)} className="rounded bg-primary-600 px-4 py-1.5 text-sm text-white hover:bg-primary-500">Save Changes</button>
              <button onClick={() => setEditingId(null)} className="rounded bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [form, setForm] = useState({ code: '', name: '', discountPercent: 30, discountMonths: 3, applicablePlans: 'pro,premium', maxUses: 1000, validUntil: '' });

  const fetchCampaigns = () => {
    fetch('http://localhost:3000/api/admin/campaigns').then(r => r.json())
      .then(d => setCampaigns(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchCampaigns(); }, []);

  const createCampaign = async () => {
    await fetch('http://localhost:3000/api/admin/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code, name: form.name, discountPercent: form.discountPercent,
        discountMonths: form.discountMonths, applicablePlans: form.applicablePlans.split(',').map(s => s.trim()),
        maxUses: form.maxUses, validUntil: form.validUntil,
      }),
    });
    setShowCreate(false);
    setForm({ code: '', name: '', discountPercent: 30, discountMonths: 3, applicablePlans: 'pro,premium', maxUses: 1000, validUntil: '' });
    fetchCampaigns();
  };

  const toggleActive = async (c: any) => {
    await fetch(`http://localhost:3000/api/admin/campaigns/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.is_active }),
    });
    fetchCampaigns();
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditForm({
      code: c.code, name: c.name, discountPercent: c.discount_percent,
      discountMonths: c.discount_months, applicablePlans: (c.applicable_plans ?? []).join(','),
      maxUses: c.max_uses, validUntil: c.valid_until?.split('T')[0] ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch(`http://localhost:3000/api/admin/campaigns/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: editForm.code, name: editForm.name, discountPercent: editForm.discountPercent,
        discountMonths: editForm.discountMonths, applicablePlans: editForm.applicablePlans.split(',').map((s: string) => s.trim()),
        maxUses: editForm.maxUses, validUntil: editForm.validUntil,
      }),
    });
    setEditingId(null);
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign code?')) return;
    await fetch(`http://localhost:3000/api/admin/campaigns/${id}`, { method: 'DELETE' });
    fetchCampaigns();
  };

  if (loading) return <div className="animate-pulse h-32 bg-gray-700 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Manage discount codes users can enter at checkout.</p>
        <button onClick={() => setShowCreate(!showCreate)} className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">+ Create Campaign</button>
      </div>

      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400 block mb-1">Code</label><input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white font-mono" placeholder="SUMMER50" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" placeholder="Summer 50% Off" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Discount %</label><input type="number" value={form.discountPercent} onChange={e => setForm({...form, discountPercent: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Duration (months)</label><input type="number" value={form.discountMonths} onChange={e => setForm({...form, discountMonths: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Max Uses</label><input type="number" value={form.maxUses} onChange={e => setForm({...form, maxUses: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
            <div><label className="text-xs text-gray-400 block mb-1">Valid Until</label><input type="date" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={createCampaign} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-500">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No campaign codes yet.</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c: any) => (
            <div key={c.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white font-bold">{c.code}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {c.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{c.name}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {c.discount_percent}% off for {c.discount_months} months · Plans: {c.applicable_plans?.join(', ')} · Uses: {c.current_uses ?? 0}/{c.max_uses} · Expires: {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white">Edit</button>
                <button onClick={() => toggleActive(c)} className={`text-xs px-2 py-1 rounded ${c.is_active ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white`}>
                  {c.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => deleteCampaign(c.id)} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setEditingId(null)}>
          <div className="bg-gray-800 rounded-xl p-6 w-[500px] border border-gray-600 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Edit Campaign</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Code</label><input value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value.toUpperCase()})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white font-mono" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Discount %</label><input type="number" value={editForm.discountPercent} onChange={e => setEditForm({...editForm, discountPercent: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Duration (months)</label><input type="number" value={editForm.discountMonths} onChange={e => setEditForm({...editForm, discountMonths: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Max Uses</label><input type="number" value={editForm.maxUses} onChange={e => setEditForm({...editForm, maxUses: +e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Valid Until</label><input type="date" value={editForm.validUntil} onChange={e => setEditForm({...editForm, validUntil: e.target.value})} className="w-full rounded bg-gray-900 border border-gray-600 px-2 py-1 text-sm text-white" /></div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="rounded bg-primary-600 px-4 py-1.5 text-sm text-white hover:bg-primary-500">Save Changes</button>
              <button onClick={() => setEditingId(null)} className="rounded bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserOverridesTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [plan, setPlan] = useState('premium');
  const [duration, setDuration] = useState('forever');
  const [searching, setSearching] = useState(false);
  const [granted, setGranted] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  // Fetch existing overrides on mount
  useEffect(() => {
    fetch('http://localhost:3000/api/admin/subscription-overrides')
      .then(r => r.json())
      .then(d => setGranted(d.data ?? []))
      .catch(() => {});
  }, []);
  const debounceRef = (globalThis as any).__debounceRef ?? { current: null };
  (globalThis as any).__debounceRef = debounceRef;

  // Search users as they type (debounced)
  const searchUsers = (q: string) => {
    setQuery(q);
    setSelectedUser(null);
    if (q.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`http://localhost:3000/api/admin/users?search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        setResults(data.data ?? []);
      } catch { setResults([]); }
      setSearching(false);
    }, 300);
  };

  const selectUser = (user: any) => {
    setSelectedUser(user);
    setQuery(user.display_name || user.email);
    setResults([]);
  };

  const grantAccess = async () => {
    if (!selectedUser) return;
    // In production: create/update user_subscriptions entry
    // For now: insert override subscription
    try {
      const planData = await fetch('http://localhost:3000/api/plans').then(r => r.json());
      const targetPlan = (planData.data ?? []).find((p: any) => p.slug === plan);
      if (!targetPlan) { setMessage('Plan not found'); return; }

      // Calculate period end based on duration
      let periodEnd: string | null = null;
      const now = new Date();
      if (duration === '3months') periodEnd = new Date(now.getTime() + 90 * 86400000).toISOString();
      else if (duration === '6months') periodEnd = new Date(now.getTime() + 180 * 86400000).toISOString();
      else if (duration === '1year') periodEnd = new Date(now.getTime() + 365 * 86400000).toISOString();
      // 'forever' = no period end

      await fetch(`http://localhost:3000/api/admin/users/${selectedUser.id}/subscription`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: plan, periodEnd }),
      });
      setMessage(`Granted ${plan} to ${selectedUser.display_name || selectedUser.email}`);
      // Refresh the overrides list from API
      const res = await fetch('http://localhost:3000/api/admin/subscription-overrides');
      const d = await res.json();
      setGranted(d.data ?? []);
      setSelectedUser(null);
      setQuery('');
    } catch { setMessage('Failed to grant access'); }
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Grant individual users free Premium access or override their plan (for promotions, beta testers, partners).</p>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-3">Grant Free Plan Access</h4>
        <div className="flex gap-2 items-start">
          {/* User search with autocomplete */}
          <div className="flex-1 relative">
            <input
              type="text" value={query}
              onChange={e => searchUsers(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400"
            />
            {selectedUser && (
              <div className="absolute right-2 top-2">
                <span className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded">✓ Selected</span>
              </div>
            )}
            {/* Dropdown results */}
            {results.length > 0 && !selectedUser && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-md shadow-xl max-h-48 overflow-y-auto">
                {results.map((u: any) => (
                  <button key={u.id} onClick={() => selectUser(u)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 flex items-center gap-2 border-b border-gray-800 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs text-white font-bold">
                      {(u.display_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{u.display_name || 'No name'}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
          </div>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
          <select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
            <option value="forever">Forever</option>
            <option value="1year">1 Year</option>
            <option value="6months">6 Months</option>
            <option value="3months">3 Months</option>
          </select>
          <button onClick={grantAccess} disabled={!selectedUser}
            className={`rounded-md px-4 py-2 text-sm text-white ${selectedUser ? 'bg-primary-600 hover:bg-primary-500' : 'bg-gray-600 cursor-not-allowed'}`}>
            Grant
          </button>
        </div>
        {message && <p className="text-xs text-green-400 mt-2">{message}</p>}
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-2">Active Overrides</h4>
        {granted.length === 0 ? (
          <p className="text-xs text-gray-500">No manual overrides configured yet.</p>
        ) : (
          <div className="space-y-2">
            {granted.map((g, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0">
                <div>
                  <span className="text-sm text-white">{g.display_name || g.email}</span>
                  <span className="text-xs text-gray-500 ml-2">{g.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary-900/30 text-primary-400 px-2 py-0.5 rounded">{g.plan_name || g.plan_slug || g.plan}</span>
                  <span className="text-xs text-gray-500">{g.current_period_end ? `Until ${new Date(g.current_period_end).toLocaleDateString()}` : 'Forever'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Global subscription settings.</p>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">Trial Duration</p>
            <select defaultValue="30" className="w-full rounded-md bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">Grace Period After Trial</p>
            <select defaultValue="7" className="w-full rounded-md bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white">
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">Payment Retry Attempts</p>
            <select defaultValue="3" className="w-full rounded-md bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white">
              <option value="1">1 attempt</option>
              <option value="3">3 attempts</option>
              <option value="5">5 attempts</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">Default Auto-Renew</p>
            <select defaultValue="true" className="w-full rounded-md bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white">
              <option value="true">Enabled (recommended)</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <div>
            <p className="text-sm text-white">Stripe Integration</p>
            <p className="text-xs text-gray-400">Connect your Stripe account for payment processing</p>
          </div>
          <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500">Configure Stripe</button>
        </div>
      </div>
    </div>
  );
}
