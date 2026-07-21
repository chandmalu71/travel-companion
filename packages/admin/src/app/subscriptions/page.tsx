'use client';

import { useState } from 'react';

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

type Tab = 'plans' | 'campaigns' | 'users' | 'settings';

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Subscriptions & Billing</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        {([['plans', '💎 Plans'], ['campaigns', '🏷️ Campaigns'], ['users', '👤 User Overrides'], ['settings', '⚙️ Settings']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === id ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'users' && <UserOverridesTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

function PlansTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Configure plan pricing and feature limits. Changes apply immediately to new subscriptions.</p>

      <div className="grid grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div key={plan.slug} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
            <p className="text-2xl font-bold text-primary-400 mb-4">
              {plan.monthlyEur === 0 ? 'Free' : `€${plan.monthlyEur}/mo`}
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Annual</span><span className="text-white">€{plan.annualEur}/yr</span></div>
              {plan.familyMonthly && <div className="flex justify-between"><span className="text-gray-400">Family (monthly)</span><span className="text-white">€{plan.familyMonthly}/mo</span></div>}
              {plan.familyAnnual && <div className="flex justify-between"><span className="text-gray-400">Family (annual)</span><span className="text-white">€{plan.familyAnnual}/yr</span></div>}
              <hr className="border-gray-700 my-2" />
              <div className="flex justify-between"><span className="text-gray-400">Active Trips</span><span className="text-white">{plan.maxTrips ?? '∞'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Expenses/mo</span><span className="text-white">{plan.maxExpenses ?? '∞'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Storage</span><span className="text-white">{plan.maxStorage >= 1024 ? `${(plan.maxStorage / 1024).toFixed(0)}GB` : `${plan.maxStorage}MB`}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Network</span><span className="text-white">{plan.maxNetwork}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Family</span><span className="text-white">{plan.maxFamily}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Aliases</span><span className="text-white">{plan.maxAliases}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Weather</span><span className="text-white">{plan.weather}-day</span></div>
            </div>

            <button className="mt-4 w-full rounded-md bg-gray-700 px-3 py-1.5 text-xs text-white hover:bg-gray-600">
              Edit Plan
            </button>
          </div>
        ))}
      </div>
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
