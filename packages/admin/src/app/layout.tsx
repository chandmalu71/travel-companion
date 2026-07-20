import type { Metadata } from 'next';
import './globals.css';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopBar } from './admin-topbar';

export const metadata: Metadata = {
  title: 'Nayya Admin',
  description: 'Nayya platform administration panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="icon" href="/favicon.svg" type="image/svg+xml" /></head>
      <body className="min-h-screen bg-gray-900 text-gray-100 font-sans antialiased">
        <div className="flex min-h-screen">
          <AdminSidebar />
          <div className="flex-1 flex flex-col overflow-auto">
            <AdminTopBar />
            <main className="flex-1 p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
