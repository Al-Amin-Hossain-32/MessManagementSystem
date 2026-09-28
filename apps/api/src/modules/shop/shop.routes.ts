import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { shopService } from './shop.service';
import { authenticate } from '../../middleware/authenticate';
import { requirePlatformAdmin, requireShopAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';
import { createShopSchema, updateShopSchema, reassignShopAdminSchema } from './shop.schema';
import { productRouter } from './product.routes';
import { shopOrderFulfillmentRouter } from './shopOrderFulfillment.routes';

const router = Router();
router.use(authenticate);

// GET /api/v1/shops — open to any authenticated user (Managers need to discover shops)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shops = await shopService.listShops();
    res.json({ success: true, data: { shops } });
  } catch (err) {
    next(err);
  }
});

router.get('/:shopId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = await shopService.getShop(req.params.shopId);
    res.json({ success: true, data: { shop } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shops — Platform Admin only
router.post(
  '/',
  requirePlatformAdmin,
  validate(createShopSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = await shopService.createShop(req.auth.userId, req.body);
      res.status(StatusCodes.CREATED).json({ success: true, data: { shop } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId — Shop Admin or Platform Admin
router.patch(
  '/:shopId',
  requireShopAdmin,
  validate(updateShopSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = await shopService.updateShop(req.auth.userId, req.params.shopId, req.body);
      res.json({ success: true, data: { shop } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/admin — Platform Admin only (reassign Shop Admin)
router.patch(
  '/:shopId/admin',
  requirePlatformAdmin,
  validate(reassignShopAdminSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shop = await shopService.reassignShopAdmin(
        req.auth.userId,
        req.params.shopId,
        req.body.managedByUserId,
      );
      res.json({ success: true, data: { shop } });
    } catch (err) {
      next(err);
    }
  },
);

router.use('/:shopId/products', productRouter);
router.use('/:shopId/orders', shopOrderFulfillmentRouter);

export { router as shopRouter };
