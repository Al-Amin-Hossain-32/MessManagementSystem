import { z } from 'zod';

function isLoopbackHostname(hostname: string): boolean {
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

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z
      .string()
      .default('4000')
      .transform(Number)
      .refine(
        (port) => Number.isInteger(port) && port > 0 && port <= 65_535,
        'PORT must be a valid TCP port',
      ),
    API_URL: z.string().url().default('http://localhost:4000'),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((val) => val.split(',').map((s) => s.trim())),
    RATE_LIMIT_WINDOW_MS: z
      .string()
      .default('900000')
      .transform(Number)
      .refine(
        (value) => Number.isInteger(value) && value > 0,
        'RATE_LIMIT_WINDOW_MS must be positive',
      ),
    RATE_LIMIT_MAX_REQUESTS: z
      .string()
      .default('100')
      .transform(Number)
      .refine(
        (value) => Number.isInteger(value) && value > 0,
        'RATE_LIMIT_MAX_REQUESTS must be positive',
      ),
    COOKIE_SECURE: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),
    COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    PLATFORM_ADMIN_BOOTSTRAP_EMAILS: z
      .string()
      .default('')
      .transform((val) =>
        val
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
  })
  .superRefine((config, context) => {
    if (config.NODE_ENV !== 'production') return;

    if (!config.COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }

    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT access and refresh secrets must be different',
      });
    }

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (config[key].toLowerCase().includes('replace-this')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must not use the example placeholder`,
        });
      }
    }

    for (const key of ['API_URL', 'WEB_URL'] as const) {
      const url = new URL(config[key]);
      if (url.protocol !== 'https:' || isLoopbackHostname(url.hostname)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must use HTTPS and must not be localhost in production`,
        });
      }
    }

    if (config.CORS_ORIGINS.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'At least one production CORS origin is required',
      });
    }

    for (const origin of config.CORS_ORIGINS) {
      let url: URL;
      try {
        url = new URL(origin);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: `Invalid CORS origin: ${origin}`,
        });
        continue;
      }
      if (url.protocol !== 'https:' || url.origin !== origin || isLoopbackHostname(url.hostname)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'Production CORS origins must be HTTPS origins and must not be localhost',
        });
      }
    }
  });
