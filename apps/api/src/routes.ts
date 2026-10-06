import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { messRouter } from './modules/mess/mess.routes';
import { vendorRouter } from './modules/shop/vendor.routes';
import { shopRouter } from './modules/shop/shop.routes';
import { userRouter } from './modules/user/user.routes';
import { notificationRouter } from './modules/notification/notification.routes';
import { platformBillingRouter } from './modules/billing/platformBilling.routes';

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

router.use('/auth', authRouter);
router.use('/messes', messRouter);
router.use('/vendors', vendorRouter);
router.use('/shops', shopRouter);
router.use('/users', userRouter);
router.use('/notifications', notificationRouter);
router.use('/platform/billing', platformBillingRouter);

export { router as apiRouter };
