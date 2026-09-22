import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { disputeService } from './dispute.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  raiseDisputeSchema,
  resolveDisputeSchema,
  dismissDisputeSchema,
  listDisputesQuerySchema,
} from './dispute.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/disputes?accountingPeriodId=&status=
router.get(
  '/',
  resolveTenant,
  requireManagerOrAdmin,
  validate(listDisputesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const disputes = await disputeService.listDisputes(req.tenant.messId, req.query as any);
      res.json({ success: true, data: { disputes } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/disputes/mine
router.get('/mine', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const disputes = await disputeService.getMyDisputes(req.tenant.messId, req.auth.userId);
    res.json({ success: true, data: { disputes } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messes/:messId/disputes/:disputeId
router.get(
  '/:disputeId',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputeService.getDispute(req.tenant.messId, req.params.disputeId);
      res.json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/disputes — Boarder raises
router.post(
  '/',
  resolveTenant,
  validate(raiseDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputeService.raiseDispute(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/disputes/:disputeId/review — Manager/Admin
router.patch(
  '/:disputeId/review',
  resolveTenant,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputeService.markUnderReview(
        req.tenant.messId,
        req.auth.userId,
        req.params.disputeId,
      );
      res.json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/disputes/:disputeId/resolve — Admin only
router.patch(
  '/:disputeId/resolve',
  resolveTenant,
  requireMessAdmin,
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputeService.resolveDispute(
        req.tenant.messId,
        req.auth.userId,
        req.params.disputeId,
        req.body.resolution,
      );
      res.json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/disputes/:disputeId/dismiss — Admin only
router.patch(
  '/:disputeId/dismiss',
  resolveTenant,
  requireMessAdmin,
  validate(dismissDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputeService.dismissDispute(
        req.tenant.messId,
        req.auth.userId,
        req.params.disputeId,
        req.body.reason,
      );
      res.json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as disputeRouter };
