'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/trips', label: 'Trips', icon: '✈️' },
  { href: '/bookings', label: 'Bookings', icon: '📋' },
  { href: '/expenses', label: 'Expenses', icon: '💰' },
  { href: '/search', label: 'Search', icon: '🔍' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-16 items-center px-6 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl">🧭</span>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary-600 leading-tight">Nayya</span>
              <span className="text-[9px] text-gray-400 leading-tight">Your Complete Travel Companion</span>
            </div>
          </Link>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="lg:hidden">
            <span className="text-lg font-bold text-primary-600">🧭</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Notifications">
              🔔
            </button>
            <button className="h-8 w-8 rounded-full bg-primary-100 text-sm font-medium text-primary-700" aria-label="User menu">
              U
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
