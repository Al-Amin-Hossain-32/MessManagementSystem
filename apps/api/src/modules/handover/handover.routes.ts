import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { handoverService } from './handover.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import {
  initiateHandoverSchema,
  submitHandoverSchema,
  disputeHandoverSchema,
  resolveDisputeSchema,
} from './handover.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/handovers
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const handovers = await handoverService.listHandovers(req.tenant.messId);
    res.json({ success: true, data: { handovers } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messes/:messId/handovers/:handoverId
router.get(
  '/:handoverId',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.getHandover(req.tenant.messId, req.params.handoverId);
      res.json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/handovers — outgoing Manager declares fund items (DRAFT)
router.post(
  '/',
  resolveTenant,
  validate(initiateHandoverSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.initiateHandover(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/handovers/:handoverId/submit
router.patch(
  '/:handoverId/submit',
  resolveTenant,
  validate(submitHandoverSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.submitHandover(
        req.tenant.messId,
        req.auth.userId,
        req.params.handoverId,
        req.body.incomingAssignmentId,
      );
      res.json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/handovers/:handoverId/accept — incoming Manager
router.patch(
  '/:handoverId/accept',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.acceptHandover(
        req.tenant.messId,
        req.auth.userId,
        req.params.handoverId,
      );
      res.json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/handovers/:handoverId/dispute — incoming Manager
router.patch(
  '/:handoverId/dispute',
  resolveTenant,
  validate(disputeHandoverSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.disputeHandover(
        req.tenant.messId,
        req.auth.userId,
        req.params.handoverId,
        req.body.disputeNotes,
      );
      res.json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/handovers/:handoverId/resolve — Mess Admin only
router.patch(
  '/:handoverId/resolve',
  resolveTenant,
  requireMessAdmin,
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const handover = await handoverService.resolveDispute(
        req.tenant.messId,
        req.auth.userId,
        req.params.handoverId,
        req.body,
      );
      res.json({ success: true, data: { handover } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as handoverRouter };
