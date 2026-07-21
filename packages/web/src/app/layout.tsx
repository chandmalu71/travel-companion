import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neyya — Your Complete Travel Companion',
  description: 'AI-powered travel planning that adapts to your style. Plan trips, track expenses, discover places, and collaborate with fellow travelers.',
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
      </body>
    </html>
  );
}
