import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { guestMealConfigService } from './guestMealConfig.service';
import { guestMealService } from './guestMeal.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  upsertGuestMealConfigSchema,
  recordGuestMealSchema,
  disputeGuestMealSchema,
} from './guestMeal.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/guest-meals/config
router.get('/config', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await guestMealConfigService.getConfig(req.tenant.messId);
    res.json({ success: true, data: { config } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/messes/:messId/guest-meals/config
router.put(
  '/config',
  resolveTenant,
  requireMessAdmin,
  validate(upsertGuestMealConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await guestMealConfigService.upsertConfig(
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

// GET /api/v1/messes/:messId/guest-meals?accountingPeriodId=... (defaults to current period)
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guestMeals = await guestMealService.listForPeriod(
      req.tenant.messId,
      req.query.accountingPeriodId as string | undefined,
    );
    res.json({ success: true, data: { guestMeals } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/messes/:messId/guest-meals — Manager/Admin records a guest meal
router.post(
  '/',
  resolveTenant,
  requireManagerOrAdmin,
  validate(recordGuestMealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guestMeal = await guestMealService.recordGuestMeal(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { guestMeal } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/guest-meals/:guestMealId/dispute — host Boarder or Admin/Manager
router.patch(
  '/:guestMealId/dispute',
  resolveTenant,
  validate(disputeGuestMealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guestMeal = await guestMealService.disputeGuestMeal(
        req.tenant.messId,
        req.auth.userId,
        req.params.guestMealId,
        req.body.reason,
      );
      res.json({ success: true, data: { guestMeal } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as guestMealRouter };
