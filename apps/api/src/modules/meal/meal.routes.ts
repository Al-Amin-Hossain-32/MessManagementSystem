import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { mealService } from './meal.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  optOutSchema,
  generateMealsSchema,
  listMealsQuerySchema,
  requestCorrectionSchema,
  reviewCorrectionSchema,
} from './meal.schema';

const router = Router({ mergeParams: true });

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Listing ────────────────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/meals?date=YYYY-MM-DD — Admin/Manager: all boarders
router.get(
  '/',
  resolveTenant,
  requireManagerOrAdmin,
  validate(listMealsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = (req.query.date as string) || todayDateStr();
      const meals = await mealService.listMealsForDate(req.tenant.messId, date);
      res.json({ success: true, data: { date, meals } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/meals/mine?date=YYYY-MM-DD — Boarder: own status
router.get(
  '/mine',
  resolveTenant,
  validate(listMealsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = (req.query.date as string) || todayDateStr();
      const meals = await mealService.getMyMealsForDate(req.tenant.messId, req.auth.userId, date);
      res.json({ success: true, data: { date, meals } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/meals/mine/history — Boarder: recent history
router.get(
  '/mine/history',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meals = await mealService.getMyMealHistory(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: { meals } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Opt-out / Opt-in ───────────────────────────────────────────────────────

// PATCH /api/v1/messes/:messId/meals/opt-out
router.patch(
  '/opt-out',
  resolveTenant,
  validate(optOutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meal = await mealService.optOut(req.tenant.messId, req.auth.userId, req.body);
      res.json({ success: true, data: { meal } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/meals/opt-in — reverse an opt-out
router.patch(
  '/opt-in',
  resolveTenant,
  validate(optOutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meal = await mealService.optIn(req.tenant.messId, req.auth.userId, req.body);
      res.json({ success: true, data: { meal } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Manual triggers (stand-ins for the Phase 3 cron infra) ────────────────────

// POST /api/v1/messes/:messId/meals/generate — Admin/Manager
router.post(
  '/generate',
  resolveTenant,
  requireManagerOrAdmin,
  validate(generateMealsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.body.date || todayDateStr();
      const result = await mealService.ensureDailyMealRecords(
        req.tenant.messId,
        date,
        req.auth.userId,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { date, ...result } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/meals/lock-expired — Admin/Manager
router.post(
  '/lock-expired',
  resolveTenant,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await mealService.lockExpiredMeals(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Correction Workflow ────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/meals/corrections — Admin/Manager
router.get(
  '/corrections',
  resolveTenant,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as any;
      const requests = await mealService.listCorrectionRequests(req.tenant.messId, status);
      res.json({ success: true, data: { requests } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/meals/:mealRecordId/corrections
router.post(
  '/:mealRecordId/corrections',
  resolveTenant,
  validate(requestCorrectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await mealService.requestCorrection(
        req.tenant.messId,
        req.auth.userId,
        req.params.mealRecordId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { request } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/meals/corrections/:requestId/approve — Admin/Manager
router.patch(
  '/corrections/:requestId/approve',
  resolveTenant,
  requireManagerOrAdmin,
  validate(reviewCorrectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await mealService.reviewCorrection(
        req.tenant.messId,
        req.auth.userId,
        req.params.requestId,
        'APPROVED',
        req.body.reviewNotes,
      );
      res.json({ success: true, data: { request } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/meals/corrections/:requestId/reject — Admin/Manager
router.patch(
  '/corrections/:requestId/reject',
  resolveTenant,
  requireManagerOrAdmin,
  validate(reviewCorrectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await mealService.reviewCorrection(
        req.tenant.messId,
        req.auth.userId,
        req.params.requestId,
        'REJECTED',
        req.body.reviewNotes,
      );
      res.json({ success: true, data: { request } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as mealRouter };
