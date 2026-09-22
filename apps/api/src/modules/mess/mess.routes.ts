import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { messService } from './mess.service';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant, requirePrimaryOwner } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { boarderRouter } from '../boarder/boarder.routes';
import { managerRouter } from '../manager/manager.routes';
import { handoverRouter } from '../handover/handover.routes';
import { accountingRouter } from '../accounting/accounting.routes';
import { mealConfigRouter } from '../meal/mealConfig.routes';
import { mealRouter } from '../meal/meal.routes';
import { guestMealRouter } from '../meal/guestMeal.routes';
import { expenseCategoryRouter } from '../expense/expenseCategory.routes';
import { expenseRouter } from '../expense/expense.routes';
import { paymentRouter } from '../payment/payment.routes';
import { disputeRouter } from '../dispute/dispute.routes';
import {
  createMessSchema,
  updateMessSchema,
  inviteCoAdminSchema,
} from './mess.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/messes — list user's messes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messes = await messService.getUserMesses(req.auth.userId);
    res.json({ success: true, data: { messes } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/messes — create a new mess
router.post(
  '/',
  validate(createMessSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mess = await messService.createMess(req.auth.userId, req.body);
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { mess },
        message: 'Mess created successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId
router.get(
  '/:messId',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mess = await messService.getMessById(req.tenant.messId, req.auth.userId);
      res.json({ success: true, data: { mess } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId
router.patch(
  '/:messId',
  resolveTenant,
  requirePrimaryOwner,
  validate(updateMessSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mess = await messService.updateMess(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.json({ success: true, data: { mess } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/co-admins — invite co-admin
router.post(
  '/:messId/co-admins',
  resolveTenant,
  requirePrimaryOwner,
  validate(inviteCoAdminSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await messService.inviteCoAdmin(
        req.tenant.messId,
        req.auth.userId,
        req.body.email,
      );
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: result,
        message: 'Co-Admin invitation sent',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Phase 2 sub-modules ────────────────────────────────────────────────────
// Each of these routers declares its own resolveTenant/resolveTenantLoose +
// role guards per-route; `authenticate` above already covers them since they
// are mounted on this same router chain.
router.use('/:messId/members', boarderRouter);
router.use('/:messId/managers', managerRouter);
router.use('/:messId/handovers', handoverRouter);
router.use('/:messId/accounting', accountingRouter);
router.use('/:messId/meal-config', mealConfigRouter);
router.use('/:messId/meals', mealRouter);
router.use('/:messId/guest-meals', guestMealRouter);
router.use('/:messId/expense-categories', expenseCategoryRouter);
router.use('/:messId/expenses', expenseRouter);
router.use('/:messId/payments', paymentRouter);
router.use('/:messId/disputes', disputeRouter);

export { router as messRouter };
