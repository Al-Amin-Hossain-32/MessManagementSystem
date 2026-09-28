import { Router, Request, Response, NextFunction } from 'express';
import { userContextService } from './userContext.service';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

// GET /api/v1/users/me/context
router.get('/me/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await userContextService.getContext(req.auth.userId);
    res.json({ success: true, data: context });
  } catch (err) {
    next(err);
  }
});

export { router as userRouter };
