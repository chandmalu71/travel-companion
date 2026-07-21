'use client';

import { useState } from 'react';

const AI_FEATURES = [
  { id: 'email_parsing', label: 'Email Parsing' },
  { id: 'receipt_scanning', label: 'Receipt Scanning' },
  { id: 'search_rewrite', label: 'Search Rewrite' },
  { id: 'gap_suggestions', label: 'Gap Suggestions' },
  { id: 'proactive_suggestions', label: 'Proactive Suggestions' },
  { id: 'trip_naming', label: 'Trip Naming' },
  { id: 'trip_tips', label: 'Trip Tips Generation' },
  { id: 'trip_tips_chat', label: 'Trip Tips Chat' },
  { id: 'messaging_ai', label: 'Messaging @AI' },
];

const MODELS = [
  { id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite ($0.06/$0.24 per 1M)' },
  { id: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro ($0.035/$0.14 per 1M)' },
  { id: 'anthropic.claude-3-5-haiku-20241022-v1:0', label: 'Claude Haiku 3.5 ($0.80/$4.00 per 1M)' },
  { id: 'deepseek.deepseek-v3-2-20250708-v1:0', label: 'DeepSeek v3.2 ($0.62/$1.85 per 1M)' },
];

const FEATURE_FLAGS = [
  { id: 'email_scanning', label: 'Email Scanning', enabled: true },
  { id: 'ai_search', label: 'AI Search', enabled: true },
  { id: 'receipt_scanning', label: 'Receipt Scanning', enabled: true },
  { id: 'social_sharing', label: 'Social Sharing', enabled: false },
  { id: 'expense_splitting', label: 'Expense Splitting', enabled: true },
  { id: 'proactive_suggestions', label: 'Proactive Suggestions', enabled: true },
  { id: 'gap_detection', label: 'Gap Detection', enabled: true },
  { id: 'weather_forecasts', label: 'Weather Forecasts', enabled: true },
];

export default function ConfigPage() {
  const [flags, setFlags] = useState(FEATURE_FLAGS);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Configuration</h1>

      {/* AI Model Config */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">AI Model Configuration</h2>
        <p className="text-sm text-gray-400 mb-4">Changes take effect within 5 seconds. No redeployment needed.</p>
        <div className="space-y-4">
          {AI_FEATURES.map((feature) => (
            <div key={feature.id} className="grid grid-cols-4 gap-4 items-center">
              <span className="text-sm text-gray-300">{feature.label}</span>
              <select className="col-span-1 rounded bg-gray-700 border border-gray-600 px-2 py-1.5 text-xs text-white">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <select className="col-span-1 rounded bg-gray-700 border border-gray-600 px-2 py-1.5 text-xs text-white">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" defaultChecked className="rounded bg-gray-700 border-gray-600" />
                Auto-escalate
              </label>
            </div>
          ))}
          <div className="text-xs text-gray-500 mt-2">
            Column 1: Tier 1 model | Column 2: Tier 2 (fallback) model
          </div>
        </div>
      </section>

      {/* Feature Flags */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Feature Flags</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {flags.map((flag, idx) => (
            <label key={flag.id}
              className={`flex items-center gap-3 rounded-lg p-3 border cursor-pointer transition-colors ${
                flag.enabled ? 'bg-green-900/20 border-green-700' : 'bg-gray-700/30 border-gray-600'
              }`}>
              <input type="checkbox" checked={flag.enabled}
                onChange={() => {
                  const updated = [...flags];
                  updated[idx] = { ...flag, enabled: !flag.enabled };
                  setFlags(updated);
                }}
                className="rounded" />
              <span className="text-sm text-gray-200">{flag.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Global Controls */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Global Controls</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Email Scanning (Global)</p>
              <p className="text-xs text-gray-400">Pause all connected email scanning across all users</p>
            </div>
            <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500">
              Pause All
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Misuse Auto-Detection</p>
              <p className="text-xs text-gray-400">Auto-suspend users exceeding rate limits</p>
            </div>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">
              Enabled
            </button>
          </div>
        </div>
      </section>

      {/* AI Trip Tips Configuration */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">AI Trip Tips</h2>
        <p className="text-sm text-gray-400 mb-4">Control which tip categories are generated and which AI features are enabled for tips.</p>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-300 uppercase mb-2">Enabled Categories</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'activities', label: '🎯 Activities', enabled: true },
                { id: 'packing', label: '🧳 Packing', enabled: true },
                { id: 'precautions', label: '⚠️ Precautions', enabled: true },
                { id: 'culture', label: '🎭 Culture', enabled: true },
                { id: 'food', label: '🍽️ Food', enabled: true },
                { id: 'transport', label: '🚌 Transport', enabled: true },
                { id: 'budget', label: '💰 Budget', enabled: true },
                { id: 'documents', label: '📋 Documents', enabled: true },
              ].map(cat => (
                <label key={cat.id} className="flex items-center gap-2 rounded-md p-2 border border-gray-600 bg-green-900/20 cursor-pointer">
                  <input type="checkbox" defaultChecked={cat.enabled} className="rounded border-gray-600" />
                  <span className="text-xs text-gray-200">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Per-Card AI Chat</p>
                <p className="text-xs text-gray-400">Allow users to ask AI about each tip category</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Location-Based Tips</p>
                <p className="text-xs text-gray-400">Allow "Nearby Tips" using GPS</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Web Search Enhancement</p>
                <p className="text-xs text-gray-400">Use web search for real-time destination info</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Cache Duration</p>
                <p className="text-xs text-gray-400">How long tips are cached before refresh</p>
              </div>
              <select defaultValue="7" className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs text-white">
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Messaging Configuration */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Messaging & Communications</h2>
        <p className="text-sm text-gray-400 mb-4">Control messaging features across the platform.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Sidebar Messages</p>
                <p className="text-xs text-gray-400">Enable Messages page in sidebar (DM, group, family)</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Trip Chat</p>
                <p className="text-xs text-gray-400">Enable Chat tab within trip detail pages</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">AI in Chat (@AI)</p>
                <p className="text-xs text-gray-400">Allow @AI mentions for AI suggestions in chats</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Polls</p>
                <p className="text-xs text-gray-400">Allow creating polls in conversations</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Trip Decisions</p>
                <p className="text-xs text-gray-400">Allow promoting messages to Trip Decisions</p>
              </div>
              <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Enabled</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Broadcast</p>
                <p className="text-xs text-gray-400">Who can send broadcast announcements</p>
              </div>
              <select defaultValue="owner" className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs text-white">
                <option value="owner">Owner only</option>
                <option value="owner_coowner">Owner + Co-owners</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-300 mb-1">Max Message Length</p>
              <select defaultValue="5000" className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs text-white">
                <option value="1000">1,000 chars</option>
                <option value="2000">2,000 chars</option>
                <option value="5000">5,000 chars</option>
                <option value="10000">10,000 chars</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300 mb-1">Max Group Size</p>
              <select defaultValue="50" className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs text-white">
                <option value="20">20 participants</option>
                <option value="50">50 participants</option>
                <option value="100">100 participants</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300 mb-1">Retention Policy</p>
              <select defaultValue="forever" className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-1.5 text-xs text-white">
                <option value="forever">Keep forever</option>
                <option value="archive_trip">Archive after trip</option>
                <option value="90days">Delete after 90 days</option>
                <option value="365days">Delete after 1 year</option>
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-2">Notification Channels</p>
            <div className="flex gap-3">
              {['In-App', 'Email', 'WhatsApp', 'SMS'].map(ch => (
                <label key={ch} className="flex items-center gap-2 rounded-md p-2 border border-gray-600 bg-green-900/20 cursor-pointer">
                  <input type="checkbox" defaultChecked={ch !== 'SMS'} className="rounded border-gray-600" />
                  <span className="text-xs text-gray-200">{ch}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Impersonation Settings */}
      <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Impersonation Settings</h2>
        <p className="text-sm text-gray-400 mb-4">Configure how admin impersonation sessions behave.</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Session Timeout</p>
              <p className="text-xs text-gray-400">How long an impersonation session lasts before auto-expiring</p>
            </div>
            <select defaultValue="60" className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Show Banner</p>
              <p className="text-xs text-gray-400">Display impersonation indicator banner in the web app</p>
            </div>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">
              Enabled
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Audit Logging</p>
              <p className="text-xs text-gray-400">Log all impersonation sessions to the audit trail</p>
            </div>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">
              Enabled
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Read-Only Mode</p>
              <p className="text-xs text-gray-400">Prevent write operations during impersonation (recommended for production)</p>
            </div>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">
              Enabled
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
