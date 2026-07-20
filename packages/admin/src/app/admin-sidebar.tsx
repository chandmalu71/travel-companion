'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/roles', label: 'Roles', icon: '🔑' },
  { href: '/memberships', label: 'Memberships', icon: '🧑‍🤝‍🧑' },
  { href: '/i18n', label: 'Locale & i18n', icon: '🌐' },
  { href: '/i18n/translations', label: 'Translations', icon: '📝' },
  { href: '/config', label: 'Configuration', icon: '⚙️' },
  { href: '/costs', label: 'Costs', icon: '💰' },
  { href: '/health', label: 'System Health', icon: '🟢' },
  { href: '/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-8 px-2">
        <span className="text-xl">🧭</span>
        <div>
          <p className="font-bold text-white text-sm">Nayya Admin</p>
          <p className="text-[10px] text-gray-400">Operations Panel</p>
        </div>
      </div>
      <nav className="space-y-1">
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
    </aside>
  );
}
