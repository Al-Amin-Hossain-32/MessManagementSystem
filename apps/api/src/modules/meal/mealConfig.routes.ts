import { Router, Request, Response, NextFunction } from 'express';
import { mealConfigService } from './mealConfig.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { upsertMealConfigSchema } from './mealConfig.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/meal-config
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await mealConfigService.getConfig(req.tenant.messId);
    res.json({ success: true, data: { config } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/messes/:messId/meal-config — create or fully replace
router.put(
  '/',
  resolveTenant,
  requireMessAdmin,
  validate(upsertMealConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await mealConfigService.upsertConfig(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.json({ success: true, data: { config } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as mealConfigRouter };
