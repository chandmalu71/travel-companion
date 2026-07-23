'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

export function AdminTopBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const APP_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace('api-', '').replace('api.', '');

  // Breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumb = segments.length === 0 ? 'Dashboard' : segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');

  return (
    <header className="h-14 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: breadcrumb */}
      <div className="text-sm text-gray-400">
        <span className="text-gray-500">Admin</span> <span className="text-gray-600 mx-1">/</span> <span className="text-gray-200">{breadcrumb}</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        {/* User menu */}
        {user && (
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
                    <p className="text-[10px] text-emerald-400 mt-0.5">{user.admin_role}</p>
                  </div>
                  <button onClick={() => { logout(); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700">Log Out</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
