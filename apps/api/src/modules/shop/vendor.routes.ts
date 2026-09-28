import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { vendorService } from './vendor.service';
import { authenticate } from '../../middleware/authenticate';
import { requirePlatformAdmin } from '../../middleware/platformAuth';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

const createVendorSchema = z.object({ name: z.string().min(2).max(150) });

// GET /api/v1/vendors
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendors = await vendorService.listVendors();
    res.json({ success: true, data: { vendors } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendors — Platform Admin only (V2+ marketplace onboarding)
router.post(
  '/',
  requirePlatformAdmin,
  validate(createVendorSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendor = await vendorService.createVendor(req.auth.userId, req.body.name);
      res.status(StatusCodes.CREATED).json({ success: true, data: { vendor } });
    } catch (err) {
      next(err);
    }
  },
);

export { router as vendorRouter };
