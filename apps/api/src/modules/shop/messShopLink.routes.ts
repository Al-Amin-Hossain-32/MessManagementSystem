import { Router, Request, Response, NextFunction } from 'express';
import { messShopLinkService } from './messShopLink.service';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { updateMessShopLinkSchema } from './messShopLink.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/shop-link
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await messShopLinkService.getLink(req.tenant.messId);
    res.json({ success: true, data: { link } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/messes/:messId/shop-link — Admin sets the default Expense Category for Shop deliveries
router.patch(
  '/',
  resolveTenant,
  requireMessAdmin,
  validate(updateMessShopLinkSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const link = await messShopLinkService.setDefaultExpenseCategory(
        req.tenant.messId,
        req.auth.userId,
        req.body.defaultExpenseCategoryId,
      );
      res.json({ success: true, data: { link } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/messes/:messId/shop-link/failed-integrations — Admin
router.get(
  '/failed-integrations',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await messShopLinkService.listFailedIntegrations(req.tenant.messId);
      res.json({ success: true, data: { records } });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/messes/:messId/shop-link/integrations/:integrationRecordId/retry — Admin
router.post(
  '/integrations/:integrationRecordId/retry',
  resolveTenant,
  requireMessAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await messShopLinkService.retryIntegration(
        req.tenant.messId,
        req.auth.userId,
        req.params.integrationRecordId,
      );
      res.json({ success: true, data: { record } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as messShopLinkRouter };
