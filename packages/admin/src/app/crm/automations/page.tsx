'use client';

import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Automation {
  id: string;
  name: string;
  trigger_event: string;
  is_active: boolean;
  steps: any[];
  total_sent: number;
  total_opened: number;
  created_at: string;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const fetchAutomations = () => {
    if (!token) return;
    fetch(`${API_BASE}/api/admin/automations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAutomations(d.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAutomations(); }, [token]);

  const toggleAutomation = async (id: string, currentState: boolean) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/admin/automations/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentState }),
    });
    fetchAutomations();
  };

  const processNow = async () => {
    if (!token) return;
    setProcessing(true);
    const res = await fetch(`${API_BASE}/api/admin/automations/process`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    alert(`Processed: ${data.data?.processed ?? 0} sends, ${data.data?.sent ?? 0} delivered`);
    setProcessing(false);
  };

  const triggerEvents: Record<string, string> = {
    lead_signup: 'New Lead Signup',
    trial_started: 'Trial Started',
    inactive_7d: 'Inactive 7 Days',
    inactive_30d: 'Inactive 30 Days',
    plan_limit_hit: 'Plan Limit Hit',
    subscription_cancelled: 'Subscription Cancelled',
  };

  if (loading) return <div className="text-gray-400 text-center py-12">Loading automations...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Automations</h1>
          <p className="text-sm text-gray-400 mt-1">Trigger-based email sequences that run automatically</p>
        </div>
        <button onClick={processNow} disabled={processing} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
          {processing ? 'Processing...' : 'Process Queue Now'}
        </button>
      </div>

      {/* Automation Cards */}
      <div className="space-y-4">
        {automations.map(auto => {
          const steps = typeof auto.steps === 'string' ? JSON.parse(auto.steps) : (auto.steps ?? []);
          return (
            <div key={auto.id} className="bg-gray-800 rounded-lg border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${auto.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <div>
                    <h3 className="text-white font-semibold">{auto.name}</h3>
                    <p className="text-xs text-gray-400">Trigger: {triggerEvents[auto.trigger_event] ?? auto.trigger_event}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-gray-400">
                    <p>{auto.total_sent} sent</p>
                    <p>{auto.total_opened} opened</p>
                  </div>
                  <button
                    onClick={() => toggleAutomation(auto.id, auto.is_active)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${auto.is_active ? 'bg-green-700 text-white hover:bg-green-600' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  >
                    {auto.is_active ? 'Active' : 'Paused'}
                  </button>
                </div>
              </div>

              {/* Steps timeline */}
              <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-2">
                {steps.map((step: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 flex-shrink-0">
                    <div className="bg-gray-700 rounded-md px-3 py-2 text-xs">
                      <p className="text-gray-300 font-medium">Day {step.day}</p>
                      <p className="text-gray-500 truncate max-w-[150px]" title={step.subject}>{step.subject}</p>
                    </div>
                    {i < steps.length - 1 && <span className="text-gray-600">→</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {automations.length === 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-500">
            No automations configured yet. They will be seeded on next deployment.
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-gray-800/50 rounded-lg border border-dashed border-gray-600 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">How Automations Work</h3>
        <div className="text-xs text-gray-400 space-y-1">
          <p>1. A trigger event occurs (e.g., new lead signs up via the landing page form)</p>
          <p>2. The matching automation sequence is activated for that contact</p>
          <p>3. Emails are queued and sent at the configured day intervals</p>
          <p>4. Opens and clicks are tracked for analytics</p>
          <p>5. If the user converts (e.g., creates account), remaining emails can be skipped</p>
        </div>
      </div>
    </div>
  );
}
