'use client';

import { useState } from 'react';

interface RateLimitRule {
  id: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  enabled: boolean;
}

const DEFAULT_RULES: RateLimitRule[] = [
  { id: '1', endpoint: 'POST /api/auth/login', maxRequests: 5, windowSeconds: 60, enabled: true },
  { id: '2', endpoint: 'POST /api/auth/register', maxRequests: 3, windowSeconds: 60, enabled: true },
  { id: '3', endpoint: 'POST /api/bookings/forward', maxRequests: 30, windowSeconds: 60, enabled: true },
  { id: '4', endpoint: 'POST /api/search', maxRequests: 20, windowSeconds: 60, enabled: true },
  { id: '5', endpoint: 'POST /api/expenses/scan', maxRequests: 10, windowSeconds: 60, enabled: true },
  { id: '6', endpoint: 'POST /api/email/connections/*/scan', maxRequests: 5, windowSeconds: 300, enabled: true },
  { id: '7', endpoint: 'GET /api/trips', maxRequests: 100, windowSeconds: 60, enabled: true },
  { id: '8', endpoint: 'Global (all endpoints)', maxRequests: 100, windowSeconds: 60, enabled: true },
];

export default function RateLimitsPage() {
  const [rules, setRules] = useState(DEFAULT_RULES);

  function updateRule(id: string, field: keyof RateLimitRule, value: any) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Rate Limit Configuration</h1>
      <p className="text-sm text-gray-400">Configure per-endpoint rate limits. Changes apply within 5 seconds.</p>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-left">
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3">Max Requests</th>
              <th className="px-4 py-3">Window (sec)</th>
              <th className="px-4 py-3">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-gray-700/50">
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{rule.endpoint}</td>
                <td className="px-4 py-3">
                  <input type="number" value={rule.maxRequests}
                    onChange={(e) => updateRule(rule.id, 'maxRequests', Number(e.target.value))}
                    className="w-20 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white" />
                </td>
                <td className="px-4 py-3">
                  <input type="number" value={rule.windowSeconds}
                    onChange={(e) => updateRule(rule.id, 'windowSeconds', Number(e.target.value))}
                    className="w-20 rounded bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-white" />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, 'enabled', e.target.checked)}
                    className="rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-500">
        Save Configuration
      </button>
    </div>
  );
}
