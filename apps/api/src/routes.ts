import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { messRouter } from './modules/mess/mess.routes';
import { vendorRouter } from './modules/shop/vendor.routes';
import { shopRouter } from './modules/shop/shop.routes';
import { userRouter } from './modules/user/user.routes';
import { notificationRouter } from './modules/notification/notification.routes';
import { platformBillingRouter } from './modules/billing/platformBilling.routes';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'messmess-api',
    },
  });
});

router.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20261006190000_initial'
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
      LIMIT 1
    `;
    if (migrations.length === 0) {
      throw new Error('Required initial database migration has not been applied');
    }
    res.json({
      success: true,
      data: { status: 'ready', service: 'messmess-api' },
    });
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed');
    res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is not ready' },
    });
  }
});

router.use('/auth', authRouter);
router.use('/messes', messRouter);
router.use('/vendors', vendorRouter);
router.use('/shops', shopRouter);
router.use('/users', userRouter);
router.use('/notifications', notificationRouter);
router.use('/platform/billing', platformBillingRouter);

export { router as apiRouter };
