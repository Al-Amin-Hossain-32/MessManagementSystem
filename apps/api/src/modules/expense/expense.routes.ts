import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { expenseService } from './expense.service';
import { expenseAllocationService } from './expenseAllocation.service';
import { resolveTenant, resolveTenantForDirectorRead, requireMessAdmin, requireManagerOrAdminOrDirectorRead } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  createExpenseSchema,
  rejectExpenseSchema,
  reverseExpenseSchema,
  listExpensesQuerySchema,
} from './expense.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/expenses?accountingPeriodId=&status=
router.get(
  '/',
  resolveTenantForDirectorRead,
  validate(listExpensesQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expenses = await expenseService.listExpenses(req.tenant.messId, req.query as any);
      res.json({ success: true, data: { expenses } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/expenses/:expenseId
router.get(
  '/:expenseId',
  resolveTenantForDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await expenseService.getExpense(req.tenant.messId, req.params.expenseId);
      res.json({ success: true, data: { expense } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/expenses — Manager/Admin records a manual expense
router.post(
  '/',
  resolveTenant,
  requireManagerOrAdmin,
  validate(createExpenseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await expenseService.createExpense(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { expense } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/expenses/:expenseId/confirm — Admin only
router.patch(
  '/:expenseId/confirm',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await expenseService.confirmDraft(
        req.tenant.messId,
        req.auth.userId,
        req.params.expenseId,
      );
      res.json({ success: true, data: { expense } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/expenses/:expenseId/reject — Admin only
router.patch(
  '/:expenseId/reject',
  resolveTenant,
  requireMessAdmin,
  validate(rejectExpenseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await expenseService.rejectExpense(
        req.tenant.messId,
        req.auth.userId,
        req.params.expenseId,
        req.body.reason,
      );
      res.json({ success: true, data: { expense } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/expenses/:expenseId/reverse — Admin only
router.patch(
  '/:expenseId/reverse',
  resolveTenant,
  requireMessAdmin,
  validate(reverseExpenseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expense = await expenseService.reverseExpense(
        req.tenant.messId,
        req.auth.userId,
        req.params.expenseId,
        req.body.reason,
        req.body.correctingExpenseId,
      );
      res.json({ success: true, data: { expense } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/expenses/allocations/:periodId/recalculate — Admin/Manager
// Re-runs the Expense Distribution Engine for every ACTIVE expense in the
// period. Safe to call repeatedly mid-month as a "running total" check;
// Phase 6 will call this same engine at period-close time as the final word.
router.post(
  '/allocations/:periodId/recalculate',
  resolveTenant,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await expenseAllocationService.allocateForPeriod(
        req.tenant.messId,
        req.params.periodId,
        req.auth.userId,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/expenses/allocations/:periodId/summary — per-Boarder totals
router.get(
  '/allocations/:periodId/summary',
  resolveTenantForDirectorRead,
  requireManagerOrAdminOrDirectorRead,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await expenseAllocationService.getAllocationSummaryForPeriod(
        req.tenant.messId,
        req.params.periodId,
      );
      res.json({ success: true, data: { summary } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as expenseRouter };
