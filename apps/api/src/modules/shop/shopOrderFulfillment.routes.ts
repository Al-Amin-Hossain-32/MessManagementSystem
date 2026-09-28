import { Router, Request, Response, NextFunction } from 'express';
import { shopOrderService } from './shopOrder.service';
import { requireShopAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';
import { recordDeliverySchema, refundOrderSchema } from './shopOrder.schema';

const router = Router({ mergeParams: true });

// GET /api/v1/shops/:shopId/orders?status=
router.get(
  '/',
  requireShopAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orders = await shopOrderService.listOrdersForShop(
        req.params.shopId,
        req.query.status as any,
      );
      res.json({ success: true, data: { orders } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/shops/:shopId/orders/:orderId
router.get(
  '/:orderId',
  requireShopAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.getShopOrder(req.params.shopId, req.params.orderId);
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/orders/:orderId/confirm — PLACED -> CONFIRMED
router.patch(
  '/:orderId/confirm',
  requireShopAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.confirmOrder(
        req.params.shopId,
        req.auth.userId,
        req.params.orderId,
      );
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/orders/:orderId/process — CONFIRMED -> PROCESSING
router.patch(
  '/:orderId/process',
  requireShopAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await shopOrderService.startProcessing(
        req.params.shopId,
        req.auth.userId,
        req.params.orderId,
      );
      res.json({ success: true, data: { order } });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/orders/:orderId/deliver — records one delivery batch, triggers the Integration Bridge
router.patch(
  '/:orderId/deliver',
  requireShopAdmin,
  validate(recordDeliverySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shopOrderService.recordDelivery(
        req.params.shopId,
        req.auth.userId,
        req.params.orderId,
        req.body,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/shops/:shopId/orders/:orderId/refund
router.patch(
  '/:orderId/refund',
  requireShopAdmin,
  validate(refundOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shopOrderService.refundOrder(
        req.params.shopId,
        req.auth.userId,
        req.params.orderId,
        req.body.refundAmount,
        req.body.reason,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export { router as shopOrderFulfillmentRouter };
