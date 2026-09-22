import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';

const createPrismaClient = () => {
  const client = new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ],
  });

  if (env.NODE_ENV === 'development') {
    // Log slow queries in development
    client.$on('query' as never, (e: { duration: number; query: string }) => {
      if (e.duration > 100) {
        logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected');
      }
    });
  }

  client.$on('error' as never, (e: { message: string }) => {
    logger.error({ message: e.message }, 'Prisma error');
  });

  return client;
};

// Prevent multiple Prisma Client instances in development (hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
