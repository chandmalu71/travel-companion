'use client';

import { useState, useEffect } from 'react';

// Plans data (in production: fetched from API)
const PLANS = [
  { slug: 'free', name: 'Free', tier: 0, monthlyEur: 0, annualEur: 0, familyMonthly: null, familyAnnual: null, maxTrips: 3, maxExpenses: 20, maxStorage: 100, maxNetwork: 20, maxFamily: 3, maxAliases: 1, weather: 3 },
  { slug: 'pro', name: 'Pro', tier: 1, monthlyEur: 14.99, annualEur: 149.99, familyMonthly: 24.99, familyAnnual: 249.99, maxTrips: null, maxExpenses: null, maxStorage: 5120, maxNetwork: 200, maxFamily: 10, maxAliases: 5, weather: 14 },
  { slug: 'premium', name: 'Premium', tier: 2, monthlyEur: 29.99, annualEur: 299.99, familyMonthly: 44.99, familyAnnual: 449.99, maxTrips: null, maxExpenses: null, maxStorage: 25600, maxNetwork: 500, maxFamily: 20, maxAliases: 15, weather: 14 },
];

const CAMPAIGNS = [
  { code: 'LAUNCH50', name: 'Launch 50% Off First 3 Months', discount: 50, months: 3, plans: ['pro', 'premium'], maxUses: 1000, used: 12, active: true, validUntil: '2026-12-31' },
  { code: 'EARLYBIRD', name: 'Early Bird 30% Off Annual', discount: 30, months: 12, plans: ['pro', 'premium'], maxUses: 500, used: 3, active: true, validUntil: '2026-09-30' },
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
  const [form, setForm] = useState({ name: '', discountPercent: 50, appliesTo: 'pro,premium', billingCycles: 'monthly,annual', startsAt: '', endsAt: '', badgeText: '' });

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

  if (loading) return <div className="animate-pulse h-40 bg-gray-700 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Site-wide promotions display crossed-out prices on the pricing page. Only one active promotion per plan is shown.</p>
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
          <div className="flex gap-2 pt-1">
            <button onClick={createPromo} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-500">Create</button>
            <button onClick={() => setShowCreate(false)} className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No promotions yet. Create one to display discounted prices.</p>
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
                    {p.is_active && !isExpired && <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded">Active</span>}
                    {isExpired && <span className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded">Expired</span>}
                    {!p.is_active && !isExpired && <span className="bg-yellow-900/30 text-yellow-400 text-xs px-2 py-0.5 rounded">Paused</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(p.starts_at).toLocaleDateString()} → {new Date(p.ends_at).toLocaleDateString()} · Plans: {p.applies_to?.join(', ')} · Badge: "{p.badge_text}"
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(p)} className={`text-xs px-2 py-1 rounded ${p.is_active ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-500'} text-white`}>
                    {p.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CampaignsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Manage discount codes and promotional campaigns.</p>
        <button className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-500">+ Create Campaign</button>
      </div>

      <div className="space-y-2">
        {CAMPAIGNS.map(c => (
          <div key={c.code} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white font-bold">{c.code}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{c.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {c.discount}% off for {c.months} months • Plans: {c.plans.join(', ')} • Uses: {c.used}/{c.maxUses} • Expires: {c.validUntil}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs text-gray-400 hover:text-white">Edit</button>
              <button className="text-xs text-red-400 hover:text-red-300">Disable</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserOverridesTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Grant individual users free Premium access or override their plan (for promotions, beta testers, partners).</p>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-3">Grant Free Premium</h4>
        <div className="flex gap-2">
          <input type="email" placeholder="User email..." className="flex-1 rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-400" />
          <select className="rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
          <select className="rounded-md bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
            <option value="forever">Forever</option>
            <option value="1year">1 Year</option>
            <option value="6months">6 Months</option>
            <option value="3months">3 Months</option>
          </select>
          <button className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500">Grant</button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-white mb-2">Active Overrides</h4>
        <p className="text-xs text-gray-500">No manual overrides configured yet.</p>
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
