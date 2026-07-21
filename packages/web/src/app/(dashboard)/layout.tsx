'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { I18nProvider } from '@/i18n/provider';
import { usePageViewTracker } from '@/hooks/use-analytics';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/trips', label: 'Trips', icon: '✈️' },
  { href: '/bookings', label: 'Bookings', icon: '📋' },
  { href: '/expenses', label: 'Expenses', icon: '💰' },
  { href: '/connections', label: 'My Network', icon: '👥' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/search', label: 'Search', icon: '🔍' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
  { href: '/settings#subscription', label: 'Upgrade', icon: '💎' },
];

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

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
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
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-16 items-center px-6 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo-header.svg" alt="Neyya" className="h-9" />
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
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="lg:hidden">
            <span className="text-lg font-bold text-primary-500">
              <img src="/logo-icon.svg" alt="Neyya" className="h-8" />
            </span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Notifications">
              🔔
            </button>

            {/* User menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{user?.displayName?.charAt(0)?.toUpperCase() ?? 'U'}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.displayName ?? 'User'}</p>
                  <p className="text-[10px] text-gray-500">{user?.email ?? ''}</p>
                </div>
                <svg className="h-4 w-4 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.displayName ?? 'User'}</p>
                      <p className="text-xs text-gray-500">{user?.email ?? ''}</p>
                    </div>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">⚙️ Settings</Link>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">👤 Profile</Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">↪️ Log Out</button>
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
      </div>
    </div>
    </I18nProvider>
  );
}
