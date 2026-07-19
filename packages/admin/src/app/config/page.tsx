'use client';

import { useState } from 'react';

const AI_FEATURES = [
  { id: 'email_parsing', label: 'Email Parsing' },
  { id: 'receipt_scanning', label: 'Receipt Scanning' },
  { id: 'search_rewrite', label: 'Search Rewrite' },
  { id: 'gap_suggestions', label: 'Gap Suggestions' },
  { id: 'proactive_suggestions', label: 'Proactive Suggestions' },
  { id: 'trip_naming', label: 'Trip Naming' },
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
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <span className="text-xl">🧭</span>
          <p className="font-bold text-white text-sm">Nayya Admin</p>
        </div>
      </aside>

      <main className="flex-1 p-8 space-y-8">
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
      </main>
    </div>
  );
}
