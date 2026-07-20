'use client';

import { useState } from 'react';

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      <StatsGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RecentActivity />
        <QuickActions />
      </div>
    </div>
  );
}

function StatsGrid() {
  const stats = [
    { label: 'Active Users (DAU)', value: '—', change: '', icon: '👥' },
    { label: 'Monthly Active', value: '—', change: '', icon: '📈' },
    { label: 'Trips Created (today)', value: '—', change: '', icon: '✈️' },
    { label: 'Bookings Imported', value: '—', change: '', icon: '📋' },
    { label: 'AI Searches', value: '—', change: '', icon: '🔍' },
    { label: 'Emails Processed', value: '—', change: '', icon: '📧' },
    { label: 'Expenses Tracked', value: '—', change: '', icon: '💰' },
    { label: 'Est. Daily Cost', value: '—', change: '', icon: '💳' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">{s.icon}</span>
            {s.change && <span className="text-xs text-green-400">{s.change}</span>}
          </div>
          <p className="text-2xl font-bold text-white">{s.value}</p>
          <p className="text-xs text-gray-400 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function RecentActivity() {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Recent Activity</h2>
      <div className="space-y-3 text-sm text-gray-400">
        <p>— Activity feed will populate with real user data —</p>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Pause Email Scanning', action: 'pause_scanning', icon: '⏸️' },
    { label: 'Send Announcement', action: 'announcement', icon: '📢' },
    { label: 'View Error Logs', action: 'errors', icon: '🚨' },
    { label: 'Export User Data', action: 'export', icon: '📥' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <button key={a.action}
            className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-600 transition-colors">
            <span>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
