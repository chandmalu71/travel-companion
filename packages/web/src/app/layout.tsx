import type { Metadata } from 'next';
import './globals.css';
import { ChatWidget } from '@/components/chat-widget';
import { ThemeProvider } from '@/components/theme-provider';
import { CookieConsentBanner } from '@/components/cookie-consent';

export const metadata: Metadata = {
  title: 'Neyya — Your Complete AI Travel Companion',
  description: 'Your Complete AI Travel Companion. Plan trips, track expenses, discover places, and collaborate with fellow travelers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo-icon.svg" />
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('neyya-theme');
              var d = (!t || t === 'system')
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                : t === 'dark';
              if (d) document.documentElement.classList.add('dark');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans antialiased transition-colors">
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            {children}
          </div>
          <CookieConsentBanner />
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
