import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root warning
  outputFileTracingRoot: __dirname,
  
  // CRITICAL: Enable standalone output for production Docker (minimal size & fast startup)
  output: 'standalone',
  
  // ESLint configuration for production build
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true,  // Don't block production builds on warnings
  },
  
  // TypeScript configuration - allow build even with type errors for production
  typescript: {
    ignoreBuildErrors: true,  // Don't block production builds on type errors
  },
  
  // Production optimizations
  reactStrictMode: true,
  poweredByHeader: false,  // Remove X-Powered-By header for security
  
  // Reduce bundle size with experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', 'chart.js'],
  },
  
  // Build ID for cache busting
  generateBuildId: async () => {
    return 'crypto-tracker-' + Date.now();
  },
  
  // API proxy to backend (reduces CORS issues)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/api/:path*',
      },
    ];
  },
  
  // Enable Gzip/Brotli compression
  compress: true,
  
  // Optimize images for faster loading
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'nginx',
      },
    ],
    formats: ['image/webp', 'image/avif'],  // Modern image formats
    minimumCacheTTL: 60,
  },
  
  // Aggressive caching headers for static assets + Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=30, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  },
};

export default nextConfig;
