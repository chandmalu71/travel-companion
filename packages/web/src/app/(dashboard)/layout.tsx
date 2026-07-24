'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { I18nProvider } from '@/i18n/provider';
import { usePageViewTracker } from '@/hooks/use-analytics';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/trips', label: 'Trips', icon: '✈️' },
  { href: '/bookings', label: 'Bookings', icon: '📋' },
  { href: '/expenses', label: 'Expenses', icon: '💰' },
  { href: '/photos', label: 'Photos', icon: '📸' },
  { href: '/connections', label: 'My Network', icon: '👥' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/search', label: 'Search', icon: '🔍' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const upgradeItem = { href: '/settings#subscription', label: 'Upgrade', icon: '💎' };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  usePageViewTracker();
  const [user, setUser] = useState<{ displayName: string; email: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationTimeLeft, setImpersonationTimeLeft] = useState('');
  const [planSlug, setPlanSlug] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }

    // Fetch user's subscription plan
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/subscription`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.data?.plan_slug || d.data?.planSlug) setPlanSlug(d.data.plan_slug ?? d.data.planSlug); })
        .catch(() => {});
    }

    // Check for impersonation mode
    if (localStorage.getItem('impersonating') === 'true') {
      setIsImpersonating(true);

      // Decode token to get expiry
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = payload.exp * 1000;

          const updateCountdown = () => {
            const remaining = expiresAt - Date.now();
            if (remaining <= 0) {
              // Session expired — end impersonation
              localStorage.removeItem('accessToken');
              localStorage.removeItem('user');
              localStorage.removeItem('impersonating');
              window.location.href = '/login';
              return;
            }
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setImpersonationTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
          };

          updateCountdown();
          const interval = setInterval(updateCountdown, 1000);
          return () => clearInterval(interval);
        } catch {}
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('loginProvider');
    localStorage.removeItem('impersonating');
    window.location.href = '/login';
  };

  const endImpersonation = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonating');
    window.close(); // Close the impersonation tab
  };

  return (
    <I18nProvider>
    {/* Impersonation banner */}
    {isImpersonating && (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center py-1 px-4 text-xs font-medium flex items-center justify-center gap-3">
        <span>👁️ Impersonating: <strong>{user?.email ?? 'unknown'}</strong></span>
        <span className="bg-amber-600 px-2 py-0.5 rounded text-[10px]">Expires in {impersonationTimeLeft}</span>
        <button onClick={endImpersonation} className="bg-amber-700 hover:bg-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold">
          End Session ✕
        </button>
      </div>
    )}
    <div className={`flex min-h-screen ${isImpersonating ? 'pt-7' : ''}`}>
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 lg:block">
        <div className="flex h-16 items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo-header.svg" alt="Neyya" className="h-9" />
            {planSlug && planSlug !== 'free' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                planSlug === 'premium' ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900' : 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
              }`}>
                {planSlug}
              </span>
            )}
          </Link>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          {[...navItems, ...((!planSlug || planSlug === 'free') ? [upgradeItem] : [])].map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
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
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6">
          <div className="lg:hidden flex items-center gap-2">
            <span className="text-lg font-bold text-primary-500">
              <img src="/logo-icon.svg" alt="Neyya" className="h-8" />
            </span>
            {planSlug && planSlug !== 'free' && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                planSlug === 'premium' ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900' : 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white'
              }`}>
                {planSlug}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            <button className="rounded-full bg-gray-100 dark:bg-gray-700 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600" aria-label="Notifications">
              🔔
            </button>

            {/* User menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{user?.displayName?.charAt(0)?.toUpperCase() ?? 'U'}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.displayName ?? 'User'}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{user?.email ?? ''}</p>
                </div>
                <svg className="h-4 w-4 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.displayName ?? 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email ?? ''}</p>
                    </div>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">⚙️ Settings</Link>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">👤 Profile</Link>
                    <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">↪️ Log Out</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
          <span>&copy; {new Date().getFullYear()} Neyya &middot; Samriddhi Capital Oy &middot; Made with <span className="text-red-500">&hearts;</span> in Finland</span>
        </footer>
      </div>
    </div>
    </I18nProvider>
  );
}
