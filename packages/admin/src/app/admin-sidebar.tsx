'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/trips', label: 'All Trips', icon: '✈️' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/roles', label: 'Roles', icon: '🔑' },
  { href: '/memberships', label: 'Memberships', icon: '🧑‍🤝‍🧑' },
  { href: '/i18n', label: 'Locale & i18n', icon: '🌐' },
  { href: '/preferences', label: 'Preferences', icon: '🎯' },
  { href: '/i18n/translations', label: 'Translations', icon: '📝' },
  { href: '/subscriptions', label: 'Subscriptions', icon: '💎' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/config', label: 'Configuration', icon: '⚙️' },
  { href: '/costs', label: 'Costs', icon: '💰' },
  { href: '/health', label: 'System Health', icon: '🟢' },
  { href: '/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; display_name: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.data?.accessToken) {
        const userData = { email: data.data.user?.email ?? email, display_name: data.data.user?.display_name ?? email };
        localStorage.setItem('admin_token', data.data.accessToken);
        localStorage.setItem('admin_user', JSON.stringify(userData));
        setUser(userData);
        setShowLogin(false);
        setEmail('');
        setPassword('');
      } else {
        setLoginError('Invalid credentials');
      }
    } catch {
      setLoginError('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
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

      {/* Navigation */}
      <nav className="space-y-1 flex-1">
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

      {/* User / Login section at bottom */}
      <div className="border-t border-gray-700 pt-3 mt-3">
        {user ? (
          <div className="flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.display_name}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700" title="Log out">
              ↪️
            </button>
          </div>
        ) : (
          <button onClick={() => setShowLogin(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
            <span>🔐</span> Log In
          </button>
        )}
      </div>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLogin(false)}>
          <div className="w-full max-w-sm rounded-lg bg-gray-800 border border-gray-700 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">N</span>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Neyya <span className="text-emerald-400">Admin</span></p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@neyya.ai"
                  className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full rounded-md border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm" />
              </div>
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button onClick={handleLogin} className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                Log In
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
