import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { boarderService } from './boarder.service';
import { resolveTenant, resolveTenantLoose, requireMessAdmin } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  inviteBoarderSchema,
  reasonSchema,
  residencyChangeSchema,
  listBoardersQuerySchema,
} from './boarder.schema';

// mergeParams: true — this router is mounted at '/:messId/members' inside
// mess.routes.ts, so req.params.messId must flow through to resolveTenant.
const router = Router({ mergeParams: true });

// Note: `authenticate` is already applied by the parent mess.routes.ts router
// before this sub-router is reached — do not re-apply it here.

// ─── Listing ────────────────────────────────────────────────────────────────

// GET /api/v1/messes/:messId/members — list boarders (Admin/Co-Admin only)
router.get(
  '/',
  resolveTenant,
  requireManagerOrAdmin, // PATCH(frontend): was requireMessAdmin — Managers need the roster for guest meals / cash payments
  validate(listBoardersQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query as { status?: any };
      const boarders = await boarderService.listBoarders(req.tenant.messId, status);
      res.json({ success: true, data: { boarders } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Admin Invite Path ────────────────────────────────────────────────────────

// POST /api/v1/messes/:messId/members/invite
router.post(
  '/invite',
  resolveTenant,
  requireMessAdmin,
  validate(inviteBoarderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.inviteBoarder(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { membership },
        message: 'Invitation sent',
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/members/accept-invite
// resolveTenantLoose: the invited user does not yet have an ACTIVE MessMembership
// or BoarderMembership, so the strict resolveTenant (which requires membership)
// would incorrectly reject them.
router.post(
  '/accept-invite',
  resolveTenantLoose,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.acceptInvite(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: { membership }, message: 'Welcome to the Mess!' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/members/decline-invite
router.post(
  '/decline-invite',
  resolveTenantLoose,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.declineInvite(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Join Request Path ────────────────────────────────────────────────────────

// POST /api/v1/messes/:messId/members/join-requests
// Any authenticated user may request to join an ACTIVE Mess (e.g. via a shared
// Mess Code / QR / invite link that resolves to this messId client-side).
router.post(
  '/join-requests',
  resolveTenantLoose,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.createJoinRequest(
        req.tenant.messId,
        req.auth.userId,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/members/join-requests/:membershipId/approve
router.patch(
  '/join-requests/:membershipId/approve',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.approveJoinRequest(
        req.tenant.messId,
        req.auth.userId,
        req.params.membershipId,
      );
      res.json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/members/join-requests/:membershipId/reject
router.patch(
  '/join-requests/:membershipId/reject',
  resolveTenant,
  requireMessAdmin,
  validate(reasonSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.rejectJoinRequest(
        req.tenant.messId,
        req.auth.userId,
        req.params.membershipId,
        req.body.reason,
      );
      res.json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Leave / Remove ────────────────────────────────────────────────────────────

// PATCH /api/v1/messes/:messId/members/leave — boarder leaves voluntarily
router.patch(
  '/leave',
  resolveTenant,
  validate(reasonSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.requestLeave(
        req.tenant.messId,
        req.auth.userId,
        req.body.reason,
      );
      res.json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/members/:membershipId/end — Admin finalizes leave / force-removes
router.patch(
  '/:membershipId/end',
  resolveTenant,
  requireMessAdmin,
  validate(reasonSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await boarderService.endMembership(
        req.tenant.messId,
        req.auth.userId,
        req.params.membershipId,
        req.body.reason,
      );
      res.json({ success: true, data: { membership } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Residency ─────────────────────────────────────────────────────────────────

// POST /api/v1/messes/:messId/members/:membershipId/residency
router.post(
  '/:membershipId/residency',
  resolveTenant,
  requireMessAdmin,
  validate(residencyChangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const residency = await boarderService.changeResidency(
        req.tenant.messId,
        req.auth.userId,
        req.params.membershipId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { residency } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as boarderRouter };
