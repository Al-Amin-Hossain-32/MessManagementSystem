import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { paymentService } from './payment.service';
import { resolveTenant, resolveTenantForDirectorRead, requireMessAdmin, requireManagerOrAdminOrDirectorRead } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import { assertSelfOrStaff } from '../../lib/messAuthz';
import {
  recordCashPaymentSchema,
  submitDigitalPaymentSchema,
  disputePaymentSchema,
  resolveDisputeSchema,
  reversePaymentSchema,
  listPaymentsQuerySchema,
} from './payment.schema';

const router = Router({ mergeParams: true });

// ─── Listing ────────────────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/payments?accountingPeriodId=&status=
router.get(
  '/',
  resolveTenantForDirectorRead,
  requireManagerOrAdminOrDirectorRead, // boarders use /mine; active Directors have read-only access
  validate(listPaymentsQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payments = await paymentService.listPayments(req.tenant.messId, req.query as any);
      res.json({ success: true, data: { payments } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/payments/fund-summary
router.get(
  '/fund-summary',
  resolveTenantForDirectorRead,
  requireManagerOrAdminOrDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await paymentService.getFundSummary(req.tenant.messId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/payments/mine
router.get('/mine', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await paymentService.getMyPayments(req.tenant.messId, req.auth.userId);
    res.json({ success: true, data: { payments } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messes/:messId/payments/:paymentId
router.get(
  '/:paymentId',
  resolveTenantForDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.getPayment(req.tenant.messId, req.params.paymentId);
      if (!req.tenant.isDirector) {
        await assertSelfOrStaff(req.tenant.messId, req.auth.userId, payment.boarderMembershipId);
      }
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Cash Payment Flow ──────────────────────────────────────────────────────

// POST /api/v1/messes/:messId/payments/cash — Manager/Admin records
router.post(
  '/cash',
  resolveTenant,
  requireManagerOrAdmin,
  validate(recordCashPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.recordCashPayment(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/payments/:paymentId/confirm-cash — Boarder confirms
router.patch(
  '/:paymentId/confirm-cash',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.confirmCashPayment(
        req.tenant.messId,
        req.auth.userId,
        req.params.paymentId,
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/payments/:paymentId/dispute-cash — Boarder disputes
router.patch(
  '/:paymentId/dispute-cash',
  resolveTenant,
  validate(disputePaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.disputeCashPayment(
        req.tenant.messId,
        req.auth.userId,
        req.params.paymentId,
        req.body.reason,
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Digital Payment Flow ───────────────────────────────────────────────────

// POST /api/v1/messes/:messId/payments/digital — Boarder submits
router.post(
  '/digital',
  resolveTenant,
  validate(submitDigitalPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.submitDigitalPayment(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/payments/:paymentId/verify-digital — Manager/Admin
router.patch(
  '/:paymentId/verify-digital',
  resolveTenant,
  requireManagerOrAdmin,
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.verifyDigitalPayment(
        req.tenant.messId,
        req.auth.userId,
        req.params.paymentId,
        req.body.decision,
        req.body.reason,
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Admin Resolution & Reversal ────────────────────────────────────────────

// PATCH /api/v1/messes/:messId/payments/:paymentId/resolve — Admin only
// Handles DISPUTED payments and the self-approval-blocked case.
router.patch(
  '/:paymentId/resolve',
  resolveTenant,
  requireMessAdmin,
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.adminResolvePayment(
        req.tenant.messId,
        req.auth.userId,
        req.params.paymentId,
        req.body.decision,
        req.body.reason,
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/payments/:paymentId/reverse — Admin only
router.patch(
  '/:paymentId/reverse',
  resolveTenant,
  requireMessAdmin,
  validate(reversePaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await paymentService.reversePayment(
        req.tenant.messId,
        req.auth.userId,
        req.params.paymentId,
        req.body.reason,
        req.body.correctingPaymentId,
      );
      res.json({ success: true, data: { payment } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as paymentRouter };
