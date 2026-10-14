import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fleet HQ is a client-side app over the API; a static export deploys anywhere (Netlify, S3, Vercel).
  output: 'export',
  transpilePackages: ['@ridesrus/core'],
  images: { unoptimized: true },
};

export default nextConfig;
