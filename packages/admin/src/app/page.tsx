'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/config', label: 'Configuration', icon: '⚙️' },
  { href: '/costs', label: 'Costs', icon: '💰' },
  { href: '/health', label: 'System Health', icon: '🟢' },
  { href: '/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
];

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <span className="text-xl">🧭</span>
          <div>
            <p className="font-bold text-white text-sm">Nayya Admin</p>
            <p className="text-[10px] text-gray-400">Operations Panel</p>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
        <StatsGrid />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <RecentActivity />
          <QuickActions />
        </div>
      </main>
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
