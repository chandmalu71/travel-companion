'use client';

import { useState } from 'react';

const SERVICES = [
  { id: 'bedrock', name: 'Bedrock (LLM)', icon: '🤖', cost: 0, pct: 0 },
  { id: 'google_places', name: 'Google Places', icon: '📍', cost: 0, pct: 0 },
  { id: 'textract', name: 'Textract (OCR)', icon: '📷', cost: 0, pct: 0 },
  { id: 'rds', name: 'RDS (PostgreSQL)', icon: '🗄️', cost: 0, pct: 0 },
  { id: 'elasticache', name: 'ElastiCache (Redis)', icon: '⚡', cost: 0, pct: 0 },
  { id: 'ecs', name: 'ECS (Fargate)', icon: '🐳', cost: 0, pct: 0 },
  { id: 's3', name: 'S3 (Storage)', icon: '📦', cost: 0, pct: 0 },
  { id: 'cloudfront', name: 'CloudFront (CDN)', icon: '🌐', cost: 0, pct: 0 },
  { id: 'ses', name: 'SES (Email)', icon: '📧', cost: 0, pct: 0 },
  { id: 'sqs', name: 'SQS (Queues)', icon: '📬', cost: 0, pct: 0 },
  { id: 'lambda', name: 'Lambda', icon: '⚙️', cost: 0, pct: 0 },
];

const PERIODS = ['Today', 'This Week', 'This Month', 'Last 30 Days'];

export default function CostsPage() {
  const [period, setPeriod] = useState('This Month');
  const [alertThreshold, setAlertThreshold] = useState(500);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Cost Monitoring</h1>
          <a href="https://eu-west-1.console.aws.amazon.com/cost-management/home" target="_blank" rel="noopener"
            className="text-sm text-primary-400 hover:text-primary-300">
            Open AWS Cost Explorer →
          </a>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm ${period === p ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Total cost card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400">Total ({period})</p>
          <p className="text-4xl font-bold text-white mt-1">$—</p>
          <p className="text-xs text-gray-500 mt-2">Data refreshes daily from AWS Cost Explorer API (24h delay)</p>
        </div>

        {/* Per-service breakdown */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Per-Service Breakdown</h2>
          <div className="space-y-3">
            {SERVICES.map((svc) => (
              <div key={svc.id} className="flex items-center gap-4">
                <span className="text-lg w-8">{svc.icon}</span>
                <span className="text-sm text-gray-300 w-40">{svc.name}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3">
                  <div className="bg-primary-500 h-3 rounded-full" style={{ width: `${svc.pct}%` }} />
                </div>
                <span className="text-sm text-gray-400 w-20 text-right">${svc.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Per-user attribution */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Top Users by Cost</h2>
          <p className="text-sm text-gray-400">Tracks: emails parsed, AI searches, receipts scanned</p>
          <div className="mt-4 text-sm text-gray-500">— Per-user cost data will populate from usage tracking —</div>
        </section>

        {/* Alert configuration */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Cost Alerts</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-300">Alert when monthly spend exceeds:</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input type="number" value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="w-24 rounded bg-gray-700 border border-gray-600 px-3 py-1.5 text-sm text-white" />
            </div>
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-500">
              Save Alert
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Sends email notification to admin when threshold is crossed.</p>
        </section>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <span className="text-xl">🧭</span>
        <p className="font-bold text-white text-sm">Nayya Admin</p>
      </div>
    </aside>
  );
}
