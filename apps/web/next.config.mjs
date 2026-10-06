/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:4000';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized) ||
    normalized === '[::1]' ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  );
}

if (process.env.NODE_ENV === 'production') {
  for (const [name, value] of [
    ['API_ORIGIN', API_ORIGIN],
    ['NEXT_PUBLIC_SOCKET_URL', SOCKET_URL],
  ]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || isLoopbackHostname(url.hostname)) {
      throw new Error(`${name} must be a public HTTPS URL for production builds`);
    }
  }
}

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
