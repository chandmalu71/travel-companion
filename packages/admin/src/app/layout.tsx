import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './auth-provider';
import { AuthGate } from './auth-gate';

export const metadata: Metadata = {
  title: 'Neyya Admin',
  description: 'Neyya platform administration panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="icon" href="/favicon.svg" type="image/svg+xml" /></head>
      <body className="min-h-screen bg-gray-900 text-gray-100 font-sans antialiased">
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
