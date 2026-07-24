'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from './auth-provider';

interface NavGroup {
  label: string;
  icon: string;
  items: { href: string; label: string; icon: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: '📊',
    items: [
      { href: '/', label: 'Dashboard', icon: '📊' },
      { href: '/analytics', label: 'Analytics', icon: '📈' },
      { href: '/trips', label: 'All Trips', icon: '✈️' },
      { href: '/memberships', label: 'Memberships', icon: '🧑‍🤝‍🧑' },
    ],
  },
  {
    label: 'User Management',
    icon: '👥',
    items: [
      { href: '/users', label: 'Users', icon: '👥' },
      { href: '/roles', label: 'Roles', icon: '🔑' },
      { href: '/moderation', label: 'Moderation', icon: '🛡️' },
    ],
  },
  {
    label: 'CRM & Marketing',
    icon: '📋',
    items: [
      { href: '/crm', label: 'Leads', icon: '📋' },
      { href: '/crm/campaigns', label: 'Campaigns', icon: '📧' },
      { href: '/crm/automations', label: 'Automations', icon: '⚡' },
      { href: '/crm/social', label: 'Social Media', icon: '📱' },
    ],
  },
  {
    label: 'Subscriptions',
    icon: '💎',
    items: [
      { href: '/subscriptions', label: 'Plans & Pricing', icon: '💎' },
    ],
  },
  {
    label: 'Localisation',
    icon: '🌐',
    items: [
      { href: '/i18n', label: 'Locale & i18n', icon: '🌐' },
      { href: '/i18n/translations', label: 'Translations', icon: '📝' },
      { href: '/preferences', label: 'Preferences', icon: '🎯' },
    ],
  },
  {
    label: 'System',
    icon: '⚙️',
    items: [
      { href: '/config', label: 'Configuration', icon: '⚙️' },
      { href: '/costs', label: 'Costs', icon: '💰' },
      { href: '/email', label: 'Email', icon: '📨' },
      { href: '/health', label: 'System Health', icon: '🟢' },
      { href: '/audit', label: 'Audit Log', icon: '📋' },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsed(prev => {
      // Auto-collapse all other groups when opening a new one
      const newState: Record<string, boolean> = {};
      for (const group of NAV_GROUPS) {
        if (group.label === label) {
          newState[group.label] = !prev[group.label];
        } else {
          newState[group.label] = true; // collapse others
        }
      }
      return newState;
    });
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)));
  };

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex-shrink-0 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">N</span>
        </div>
        <div>
          <p className="font-bold text-white text-sm">Neyya <span className="text-emerald-400">Admin</span></p>
          <p className="text-[10px] text-gray-500">Operations Panel</p>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1">
        {NAV_GROUPS.map((group) => {
          const isActive = isGroupActive(group);
          const isOpen = !collapsed[group.label] || isActive;

          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{group.icon}</span>
                  {group.label}
                </span>
                <svg
                  className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Group items */}
              {isOpen && (
                <div className="ml-2 space-y-0.5">
                  {group.items.map((item) => {
                    const itemActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          itemActive ? 'bg-gray-700 text-white font-medium' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                        }`}
                      >
                        <span className="text-xs">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section at bottom */}
      {user && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.display_name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              <p className="text-[10px] text-emerald-400 truncate">{user.admin_role}</p>
            </div>
            <button onClick={logout} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700" title="Log out">
              ↪️
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
