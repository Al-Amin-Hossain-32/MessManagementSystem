import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { productService } from './product.service';
import { requireShopAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';
import { createProductSchema, updateProductSchema } from './product.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/shops/:shopId/products — open to any authenticated user (Managers browse to order)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const products = await productService.listProducts(req.params.shopId, activeOnly);
    res.json({ success: true, data: { products } });
  } catch (err) {
    next(err);
  }
});

router.get('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProduct(req.params.shopId, req.params.productId);
    res.json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shops/:shopId/products — Shop Admin only
router.post(
  '/',
  requireShopAdmin,
  validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.createProduct(
        req.params.shopId,
        req.auth.userId,
        req.body,
      );
      res.status(StatusCodes.CREATED).json({ success: true, data: { product } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/products/:productId — Shop Admin only
router.patch(
  '/:productId',
  requireShopAdmin,
  validate(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.updateProduct(
        req.params.shopId,
        req.auth.userId,
        req.params.productId,
        req.body,
      );
      res.json({ success: true, data: { product } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as productRouter };
