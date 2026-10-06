import assert from 'node:assert/strict';
import test from 'node:test';
import { envSchema } from './env.schema';

const productionEnvironment = {
  NODE_ENV: 'production',
  API_URL: 'https://api.example.com',
  WEB_URL: 'https://app.example.com',
  DATABASE_URL: 'postgresql://messmess:example@db.example.com:5432/messmess',
  JWT_ACCESS_SECRET: 'access-secret-for-tests-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests-with-at-least-32-characters',
  CORS_ORIGINS: 'https://app.example.com',
  COOKIE_SECURE: 'true',
};

test('production environment accepts secure HTTPS configuration', () => {
  assert.equal(envSchema.safeParse(productionEnvironment).success, true);
});

test('production environment rejects insecure cookies and localhost URLs', () => {
  const result = envSchema.safeParse({
    ...productionEnvironment,
    COOKIE_SECURE: 'false',
    API_URL: 'http://localhost:4000',
    WEB_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:3000',
  });

  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((issue) => issue.path.join('.'));
  assert.ok(paths.includes('COOKIE_SECURE'));
  assert.ok(paths.includes('API_URL'));
  assert.ok(paths.includes('WEB_URL'));
  assert.ok(paths.includes('CORS_ORIGINS'));
});

test('production environment rejects loopback IP aliases', () => {
  const result = envSchema.safeParse({
    ...productionEnvironment,
    API_URL: 'https://127.0.0.2',
    CORS_ORIGINS: 'https://127.0.0.2',
  });

  assert.equal(result.success, false);
});

test('production environment rejects example JWT secrets and shared signing keys', () => {
  const result = envSchema.safeParse({
    ...productionEnvironment,
    JWT_ACCESS_SECRET: 'your-access-secret-min-32-chars-replace-this-in-production',
    JWT_REFRESH_SECRET: 'your-access-secret-min-32-chars-replace-this-in-production',
  });

  assert.equal(result.success, false);
  if (result.success) return;
  const paths = result.error.issues.map((issue) => issue.path.join('.'));
  assert.ok(paths.includes('JWT_ACCESS_SECRET'));
  assert.ok(paths.includes('JWT_REFRESH_SECRET'));
});
