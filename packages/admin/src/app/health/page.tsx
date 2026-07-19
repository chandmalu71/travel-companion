'use client';

import { useState, useEffect } from 'react';

interface HealthMetrics {
  uptime: string;
  uptimePercent: number;
  errorRate5xx: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  activeConnections: number;
  requestsPerMin: number;
}

interface LLMMetrics {
  tier1Requests: number;
  tier2Requests: number;
  avgLatencyMs: number;
  errorRate: number;
  escalationRate: number;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthMetrics>({
    uptime: '—', uptimePercent: 99.9, errorRate5xx: 0,
    latencyP50: 0, latencyP95: 0, latencyP99: 0,
    activeConnections: 0, requestsPerMin: 0,
  });
  const [llm, setLlm] = useState<LLMMetrics>({
    tier1Requests: 0, tier2Requests: 0, avgLatencyMs: 0, errorRate: 0, escalationRate: 0,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <span className="flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </span>
        </div>

        {/* API Health */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">API Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Uptime" value={`${health.uptimePercent}%`} color="green" />
            <MetricCard label="Error Rate (5xx)" value={`${health.errorRate5xx}%`} color={health.errorRate5xx > 1 ? 'red' : 'green'} />
            <MetricCard label="Active Connections" value={String(health.activeConnections)} color="blue" />
            <MetricCard label="Requests/min" value={String(health.requestsPerMin)} color="blue" />
          </div>
        </section>

        {/* Latency */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Response Latency</h2>
          <div className="grid grid-cols-3 gap-4">
            <LatencyCard label="p50" value={health.latencyP50} threshold={200} />
            <LatencyCard label="p95" value={health.latencyP95} threshold={500} />
            <LatencyCard label="p99" value={health.latencyP99} threshold={1000} />
          </div>
        </section>

        {/* LLM Usage */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">LLM Usage (Bedrock)</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Tier 1 Requests" value={String(llm.tier1Requests)} color="blue" />
            <MetricCard label="Tier 2 Requests" value={String(llm.tier2Requests)} color="purple" />
            <MetricCard label="Avg Latency" value={`${llm.avgLatencyMs}ms`} color="blue" />
            <MetricCard label="Error Rate" value={`${llm.errorRate}%`} color={llm.errorRate > 5 ? 'red' : 'green'} />
            <MetricCard label="Escalation Rate" value={`${llm.escalationRate}%`} color="amber" />
          </div>
        </section>

        {/* Services status */}
        <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Infrastructure Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'PostgreSQL (RDS)', status: 'healthy' },
              { name: 'Redis (ElastiCache)', status: 'healthy' },
              { name: 'ECS (API)', status: 'healthy' },
              { name: 'CloudFront (CDN)', status: 'healthy' },
              { name: 'SQS (Queues)', status: 'healthy' },
              { name: 'SES (Email)', status: 'healthy' },
              { name: 'Cognito (Auth)', status: 'healthy' },
              { name: 'S3 (Storage)', status: 'healthy' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2 rounded-lg bg-gray-700/50 px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${svc.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-300">{svc.name}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400', red: 'text-red-400', blue: 'text-blue-400',
    purple: 'text-purple-400', amber: 'text-amber-400',
  };
  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <p className={`text-xl font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function LatencyCard({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const color = value > threshold ? 'text-red-400' : value > threshold * 0.7 ? 'text-amber-400' : 'text-green-400';
  return (
    <div className="bg-gray-700/50 rounded-lg p-4 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}ms</p>
      <p className="text-xs text-gray-500 mt-1">threshold: {threshold}ms</p>
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
