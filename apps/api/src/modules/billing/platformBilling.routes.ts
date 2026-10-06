import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requirePlatformAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';
import { billingService } from './billing.service';
import { billingRequestIdSchema, listBillingRequestsSchema, rejectBillingRequestSchema } from './billing.schema';

const router = Router();
router.use(authenticate, requirePlatformAdmin);

router.get('/requests', validate(listBillingRequestsSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await billingService.listPlatformRequests(listBillingRequestsSchema.parse(req.query));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/requests/:requestId/approve', validate(billingRequestIdSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await billingService.approveRequest(req.params.requestId, req.auth.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.patch('/requests/:requestId/reject', validate(billingRequestIdSchema, 'params'), validate(rejectBillingRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await billingService.rejectRequest(req.params.requestId, req.auth.userId, req.body.reason);
    res.json({ success: true, data: { request } });
  } catch (error) {
    next(error);
  }
});

export { router as platformBillingRouter };
