import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { shopOrderService } from './shopOrder.service';
import { resolveTenant } from '../../middleware/resolveTenant';
import { requireManagerOrAdmin } from '../../middleware/requireManager';
import { validate } from '../../middleware/validate';
import {
  createShopOrderSchema,
  replaceOrderLinesSchema,
  cancelOrderSchema,
} from './shopOrder.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/messes/:messId/shop-orders
router.get('/', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await shopOrderService.listOrdersForMess(req.tenant.messId, req.query.status as any);
    res.json({ success: true, data: { orders } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/messes/:messId/shop-orders/:orderId
router.get('/:orderId', resolveTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await shopOrderService.getOrder(req.tenant.messId, req.params.orderId);
    res.json({ success: true, data: { order } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/messes/:messId/shop-orders — Manager creates a DRAFT
router.post(
  '/',
  resolveTenant,
  requireManagerOrAdmin,
  validate(createShopOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.createOrder(req.tenant.messId, req.auth.userId, req.body);
      res.status(StatusCodes.CREATED).json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/shop-orders/:orderId/lines — only while DRAFT, only the placing Manager
router.patch(
  '/:orderId/lines',
  resolveTenant,
  validate(replaceOrderLinesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.replaceOrderLines(
        req.tenant.messId,
        req.auth.userId,
        req.params.orderId,
        req.body,
      );
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/shop-orders/:orderId/place
router.patch(
  '/:orderId/place',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.placeOrder(
        req.tenant.messId,
        req.auth.userId,
        req.params.orderId,
      );
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/messes/:messId/shop-orders/:orderId/cancel — Manager or Admin
router.patch(
  '/:orderId/cancel',
  resolveTenant,
  requireManagerOrAdmin,
  validate(cancelOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.cancelOrder(
        req.tenant.messId,
        req.auth.userId,
        req.params.orderId,
        req.body.reason,
      );
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as shopOrderRouter };
