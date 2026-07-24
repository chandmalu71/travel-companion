import type { Metadata } from 'next';
import './globals.css';
import { ChatWidget } from '@/components/chat-widget';

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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo-icon.svg" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
