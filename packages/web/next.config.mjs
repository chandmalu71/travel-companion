/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@travel-companion/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
