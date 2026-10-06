import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectDatabase, disconnectDatabase } from './lib/prisma';
import { attachChatSocket } from './modules/chat/chat.socket';

async function bootstrap() {
  try {
    // Validate env (already done on import, but making intent explicit)
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Starting MessMess API');

    // Connect to database
    await connectDatabase();

    const app = createApp();
    const server = createServer(app);
    const io = attachChatSocket(server);
    server.listen(env.PORT, () => {
      logger.info(`🚀 API running on http://localhost:${env.PORT}/api/v1`);
      logger.info(`📊 Health check: http://localhost:${env.PORT}/api/v1/health`);
    });

    // ─── Graceful Shutdown ─────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');

      io.close(async () => {
        logger.info('HTTP and Socket.IO server closed');
        await disconnectDatabase();
        logger.info('Database disconnected. Goodbye.');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Promise Rejection');
      // Do not exit — let error propagate naturally
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception — shutting down');
      process.exit(1);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
