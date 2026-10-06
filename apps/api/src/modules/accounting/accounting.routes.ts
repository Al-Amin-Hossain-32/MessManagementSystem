import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { periodService } from './period.service';
import { periodCloseService } from './periodClose.service';
import { statementService } from './statement.service';
import { resolveTenant, resolveTenantForDirectorRead, requireMessAdmin, requireMessAdminOrDirectorRead } from '../../middleware/resolveTenant';
import { assertSelfOrStaff } from '../../lib/messAuthz';
import { validate } from '../../middleware/validate';

const router = Router({ mergeParams: true });

const closePeriodSchema = z.object({ forceOverride: z.boolean().default(false) });

const createAdjustmentSchema = z.object({
  targetType: z.enum(['BOARDER_STATEMENT', 'EXPENSE', 'PAYMENT']),
  targetId: z.string().cuid(),
  reason: z.string().min(3).max(1000),
  adjustedAmount: z.number().optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Period lookup ──────────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/accounting/current-period
router.get(
  '/current-period',
  resolveTenantForDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = await periodService.getCurrentPeriod(req.tenant.messId);
      res.json({ success: true, data: { period } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/accounting/periods
router.get('/periods', resolveTenantForDirectorRead, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const periods = await periodService.listPeriods(req.tenant.messId);
    res.json({ success: true, data: { periods } });
  } catch (err) {
    next(err);
  }
});

// ─── Period Lifecycle (Admin only) ──────────────────────────────────────────

// POST /api/v1/messes/:messId/accounting/periods/:periodId/initiate-close
// ACTIVE -> PREPARING -> UNDER_REVIEW (meal finalization, meal rate calc,
// final expense allocation, statement generation — see periodClose.service.ts)
router.post(
  '/periods/:periodId/initiate-close',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = await periodCloseService.initiateClose(
        req.tenant.messId,
        req.auth.userId,
        req.params.periodId,
      );
      res.json({ success: true, data: { period } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/accounting/periods/:periodId/close
// UNDER_REVIEW -> CLOSED
router.post(
  '/periods/:periodId/close',
  resolveTenant,
  requireMessAdmin,
  validate(closePeriodSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = await periodCloseService.closePeriod(
        req.tenant.messId,
        req.auth.userId,
        req.params.periodId,
        req.body.forceOverride,
      );
      res.json({ success: true, data: { period } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/accounting/periods/:periodId/adjustments
// Post-close correction — period must be CLOSED
router.post(
  '/periods/:periodId/adjustments',
  resolveTenant,
  requireMessAdmin,
  validate(createAdjustmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adjustment = await periodCloseService.createAdjustment(
        req.tenant.messId,
        req.auth.userId,
        req.params.periodId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { adjustment } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/accounting/periods/:periodId/adjustments
router.get(
  '/periods/:periodId/adjustments',
  resolveTenantForDirectorRead,
  requireMessAdminOrDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adjustments = await periodCloseService.listAdjustments(
        req.tenant.messId,
        req.params.periodId,
      );
      res.json({ success: true, data: { adjustments } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Statements ─────────────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/accounting/periods/:periodId/statements — Admin/Manager view all
router.get(
  '/periods/:periodId/statements',
  resolveTenantForDirectorRead,
  requireMessAdminOrDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const statements = await statementService.listStatementsForPeriod(
        req.tenant.messId,
        req.params.periodId,
      );
      res.json({ success: true, data: { statements } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/accounting/periods/:periodId/statements/mine — Boarder's own
router.get(
  '/periods/:periodId/statements/mine',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const statement = await statementService.getMyStatement(
        req.tenant.messId,
        req.auth.userId,
        req.params.periodId,
      );
      res.json({ success: true, data: { statement } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/accounting/statements/history — Boarder's own, across periods
router.get(
  '/statements/history',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const statements = await statementService.getMyStatementHistory(
        req.tenant.messId,
        req.auth.userId,
      );
      res.json({ success: true, data: { statements } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/accounting/statements/:statementId
router.get(
  '/statements/:statementId',
  resolveTenantForDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const statement = await statementService.getStatement(
        req.tenant.messId,
        req.params.statementId,
      );
      if (!req.tenant.isDirector) {
        await assertSelfOrStaff(req.tenant.messId, req.auth.userId, statement.boarderMembershipId);
      }
      res.json({ success: true, data: { statement } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as accountingRouter };
