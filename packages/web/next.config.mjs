/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@travel-companion/shared'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Disable browser caching of dev assets to prevent stale CSS/JS 404s
  headers: async () => [
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, must-revalidate' },
      ],
    },
  ],
};

export default nextConfig;
