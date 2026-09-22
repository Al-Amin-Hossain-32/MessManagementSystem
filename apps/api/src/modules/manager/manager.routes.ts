import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { managerService } from './manager.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { assignManagerSchema, terminateAssignmentSchema } from './manager.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/managers — full assignment history
router.get(
  '/',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignments = await managerService.listAssignments(req.tenant.messId);
      res.json({ success: true, data: { assignments } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/managers/current
router.get(
  '/current',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await managerService.getCurrentManager(req.tenant.messId);
      res.json({ success: true, data: { assignment } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/managers — assign a new Manager
router.post(
  '/',
  resolveTenant,
  requireMessAdmin,
  validate(assignManagerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await managerService.assignManager(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { assignment },
        message: 'Manager assigned — awaiting acceptance',
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/managers/:assignmentId/accept
router.patch(
  '/:assignmentId/accept',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await managerService.acceptAssignment(
        req.tenant.messId,
        req.auth.userId,
        req.params.assignmentId,
      );
      res.json({ success: true, data: { assignment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/managers/:assignmentId/complete
router.patch(
  '/:assignmentId/complete',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await managerService.completeAssignment(
        req.tenant.messId,
        req.auth.userId,
        req.params.assignmentId,
      );
      res.json({ success: true, data: { assignment } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/managers/:assignmentId/terminate — Admin only
router.patch(
  '/:assignmentId/terminate',
  resolveTenant,
  requireMessAdmin,
  validate(terminateAssignmentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignment = await managerService.terminateEarly(
        req.tenant.messId,
        req.auth.userId,
        req.params.assignmentId,
        req.body.reason,
      );
      res.json({ success: true, data: { assignment } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as managerRouter };
