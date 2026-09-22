import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { expenseCategoryService } from './expenseCategory.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { createExpenseCategorySchema, updateExpenseCategorySchema } from './expenseCategory.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/expense-categories?activeOnly=true
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const categories = await expenseCategoryService.list(req.tenant.messId, activeOnly);
    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messes/:messId/expense-categories/:categoryId
router.get(
  '/:categoryId',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await expenseCategoryService.getById(req.tenant.messId, req.params.categoryId);
      res.json({ success: true, data: { category } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/expense-categories — Admin only
router.post(
  '/',
  resolveTenant,
  requireMessAdmin,
  validate(createExpenseCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await expenseCategoryService.create(
        req.tenant.messId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { category } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/expense-categories/:categoryId — Admin only
router.patch(
  '/:categoryId',
  resolveTenant,
  requireMessAdmin,
  validate(updateExpenseCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await expenseCategoryService.update(
        req.tenant.messId,
        req.auth.userId,
        req.params.categoryId,
        req.body,
      );
      res.json({ success: true, data: { category } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as expenseCategoryRouter };
