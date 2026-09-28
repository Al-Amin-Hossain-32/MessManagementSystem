import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Redis (BullMQ)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((s) => s.trim())),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Cookies
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  // Platform Admin bootstrap — comma-separated emails auto-granted
  // PLATFORM_ADMIN on registration. This is the ONLY way to create the first
  // Platform Admin (there is no other bootstrap path by design — an open
  // "make me admin" endpoint would be a privilege-escalation hole). Once at
  // least one Platform Admin exists, further grants go through
  // PATCH /admin/platform-admins/:userId (Platform-Admin-only).
  PLATFORM_ADMIN_BOOTSTRAP_EMAILS: z
    .string()
    .default('')
    .transform((val) => val.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
