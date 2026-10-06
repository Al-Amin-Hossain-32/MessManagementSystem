/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  // @messmess/types ships TypeScript source (main: ./src/index.ts)
  transpilePackages: ['@messmess/types'],
  // Same-origin proxy: the browser only ever talks to /api/v1/*, so the HttpOnly
  // refresh cookie (path=/api/v1/auth) works without any CORS / SameSite tuning.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
};

export default nextConfig;
