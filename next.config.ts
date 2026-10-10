import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // PostgreSQL, poster files and redirected logs must never trigger Fast Refresh.
  webpack(config, { dev }) {
    if (dev) config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/.local/**', '**/.git/**', '**/node_modules/**', '**/test-results/**', '**/playwright-report/**'],
    };
    return config;
  },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
  ] }]; }
};
export default config;
