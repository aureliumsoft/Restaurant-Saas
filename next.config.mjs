/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Avoid /orders (confusing vs middleware `/order*` → web-app); canonical list is /sales
    return [{ source: '/orders', destination: '/sales', permanent: true }];
  },
  // Large base64 cover images on admin blog / branding payloads
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
    middlewareClientMaxBodySize: '6mb',
  },
  // ESLint 9 + legacy .eslintrc can throw "circular structure to JSON" during `next build`; lint via `npm run lint` locally.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: [
      'images.unsplash.com',
      'openweathermap.org',
      'pbs.twimg.com',
      'via.placeholder.com',
      'belorder-cloud.s3.eu-central-1.amazonaws.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
  env: {
    WEATHER_API: process.env.WEATHER_API,
  },
};

export default nextConfig;
