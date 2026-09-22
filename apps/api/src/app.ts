import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './lib/logger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use(helmet());
  app.set('trust proxy', 1); // Trust first proxy (for correct IP in rate limiting)

  // ─── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Request Logging ───────────────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          // Don't log headers (may contain tokens)
        }),
      },
    }),
  );

  // ─── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // ─── Global Rate Limiting ──────────────────────────────────────────────────
  app.use(
    '/api',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      },
    }),
  );

  // ─── Auth-specific Rate Limiting ───────────────────────────────────────────
  app.use(
    '/api/v1/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 login attempts per 15 min per IP
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many login attempts. Please try again in 15 minutes.',
        },
      },
    }),
  );

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/v1', apiRouter);

  // ─── 404 Handler ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ─── Global Error Handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
