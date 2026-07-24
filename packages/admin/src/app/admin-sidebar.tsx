'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/trips', label: 'All Trips', icon: '✈️' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/crm', label: 'CRM & Leads', icon: '📋' },
  { href: '/crm/campaigns', label: 'Campaigns', icon: '📧' },
  { href: '/crm/automations', label: 'Automations', icon: '⚡' },
  { href: '/roles', label: 'Roles', icon: '🔑' },
  { href: '/memberships', label: 'Memberships', icon: '🧑‍🤝‍🧑' },
  { href: '/i18n', label: 'Locale & i18n', icon: '🌐' },
  { href: '/preferences', label: 'Preferences', icon: '🎯' },
  { href: '/i18n/translations', label: 'Translations', icon: '📝' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '💎' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/email', label: 'Email', icon: '📧' },
  { href: '/config', label: 'Configuration', icon: '⚙️' },
  { href: '/costs', label: 'Costs', icon: '💰' },
  { href: '/health', label: 'System Health', icon: '🟢' },
  { href: '/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

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

      {/* Navigation */}
      <nav className="space-y-1 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-gray-700 text-white font-medium' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
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
