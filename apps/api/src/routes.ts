import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { messRouter } from './modules/mess/mess.routes';

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

export { router as apiRouter };
