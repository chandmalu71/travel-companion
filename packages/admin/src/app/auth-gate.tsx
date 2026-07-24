'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from './auth-provider';
import { LoginScreen } from './login-screen';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopBar } from './admin-topbar';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading, login } = useAuth();

  // While checking localStorage (only takes one tick), show login screen
  // This avoids the pulsing N and ensures a useful UI is always visible
  if (isLoading) {
    return <LoginScreen />;
  }

  // Not logged in or not admin → show login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Authenticated admin → show full admin interface
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <AdminTopBar />
        <main className="flex-1 p-8">
          {children}
        </main>
        <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
          <span>&copy; {new Date().getFullYear()} Neyya &middot; Samriddhi Capital Oy &middot; Made with <span className="text-red-500">&hearts;</span> in Finland</span>
        </footer>
      </div>
    </div>
  );
}
