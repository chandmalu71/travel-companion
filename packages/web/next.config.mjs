/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@travel-companion/shared'],
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
