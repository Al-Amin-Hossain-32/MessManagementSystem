import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant, requirePrimaryOwner } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { billingService } from './billing.service';
import { createBillingRequestSchema, listBillingRequestsSchema } from './billing.schema';

const router = Router({ mergeParams: true });
router.use(authenticate, resolveTenant, requirePrimaryOwner);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await billingService.getMessBilling(req.tenant.messId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/requests', validate(listBillingRequestsSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await billingService.listMessRequests(req.tenant.messId, listBillingRequestsSchema.parse(req.query));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/requests', validate(createBillingRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await billingService.createRequest(req.tenant.messId, req.auth.userId, req.body);
    res.status(StatusCodes.CREATED).json({ success: true, data: { request } });
  } catch (error) {
    next(error);
  }
});

export { router as billingRouter };
