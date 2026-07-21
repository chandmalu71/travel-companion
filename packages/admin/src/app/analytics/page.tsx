'use client';

import { useEffect, useState } from 'react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/admin/analytics')
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-700 rounded-lg" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics & Engagement</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 text-center">
          <p className="text-3xl font-bold text-white">{data?.totalEvents ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Total Events</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 text-center">
          <p className="text-3xl font-bold text-primary-400">{data?.eventsToday ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Events Today</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 text-center">
          <p className="text-3xl font-bold text-green-400">{data?.uniqueUsersWeek ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Active Users (7 days)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">📊 Top Pages</h3>
          {(data?.topPages ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">No page view data yet. Events will appear as users browse the app.</p>
          ) : (
            <div className="space-y-2">
              {data.topPages.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 truncate">{p.page}</span>
                  <span className="text-xs font-mono text-primary-400">{p.views}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Features */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">🎯 Most Used Features</h3>
          {(data?.topFeatures ?? []).length === 0 ? (
            <p className="text-xs text-gray-500">No feature usage data yet. Events will appear as users interact with features.</p>
          ) : (
            <div className="space-y-2">
              {data.topFeatures.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 truncate">{f.element}</span>
                  <span className="text-xs font-mono text-green-400">{f.uses}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events by Day */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-white mb-3">📈 Events by Day (Last 30 Days)</h3>
        {(data?.eventsByDay ?? []).length === 0 ? (
          <p className="text-xs text-gray-500">No events recorded yet. Analytics start tracking when users interact with the app.</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {(data.eventsByDay ?? []).reverse().map((d: any, i: number) => {
              const max = Math.max(...(data.eventsByDay ?? []).map((x: any) => Number(x.count)));
              const height = max > 0 ? (Number(d.count) / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.count} events`}>
                  <div className="w-full bg-primary-500/60 rounded-t" style={{ height: `${height}%`, minHeight: '2px' }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integration info */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <p className="text-xs text-gray-400">
          <strong className="text-gray-300">How to track events:</strong> The web app automatically sends events via
          <code className="bg-gray-700 px-1 rounded mx-1">POST /api/analytics/event</code> for page views and feature usage.
          Events are collected anonymously for non-logged-in users and linked to user IDs when authenticated.
        </p>
      </div>
    </div>
  );
}
