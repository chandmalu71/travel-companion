'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function AdminTopBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; display_name: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    if (stored) setUser(JSON.parse(stored));
    // Listen for storage changes (login/logout in sidebar)
    const handler = () => {
      const s = localStorage.getItem('admin_user');
      setUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Re-check on every route change
  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    setUser(stored ? JSON.parse(stored) : null);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
    setShowMenu(false);
    window.location.reload();
  };

  // Breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumb = segments.length === 0 ? 'Dashboard' : segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' › ');

  return (
    <header className="h-14 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: breadcrumb */}
      <div className="text-sm text-gray-400">
        <span className="text-gray-500">Admin</span> <span className="text-gray-600 mx-1">›</span> <span className="text-gray-200">{breadcrumb}</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* Link to main app */}
        <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700">
          🌐 Main App
        </a>

        {/* User menu */}
        {user ? (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-700 transition-colors">
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{user.display_name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm text-gray-200 hidden sm:inline">{user.display_name}</span>
              <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-gray-700 bg-gray-800 shadow-lg py-1">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <p className="text-xs font-medium text-white">{user.display_name}</p>
                    <p className="text-[10px] text-gray-500">{user.email}</p>
                  </div>
                  <a href="http://localhost:3001/settings" target="_blank" rel="noopener noreferrer"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">⚙️ Settings</a>
                  <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">🌐 Switch to App</a>
                  <button onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700">↪️ Log Out</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">Not logged in</span>
        )}
      </div>
    </header>
  );
}
