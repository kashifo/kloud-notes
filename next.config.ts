import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },

  // Enable compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Optimize production builds
  productionBrowserSourceMaps: false,

  // Optimize bundle
  experimental: {
    optimizePackageImports: ['@/components', '@/lib'],
  },
};

export default nextConfig;
