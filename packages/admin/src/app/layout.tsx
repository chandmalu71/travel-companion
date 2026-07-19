import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nayya Admin',
  description: 'Nayya platform administration panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="icon" href="/favicon.svg" type="image/svg+xml" /></head>
      <body className="min-h-screen bg-gray-900 text-gray-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
