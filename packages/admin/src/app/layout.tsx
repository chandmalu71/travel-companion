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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('neyya-admin-theme');
              if (t === 'light') document.documentElement.classList.remove('dark');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans antialiased transition-colors">
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
