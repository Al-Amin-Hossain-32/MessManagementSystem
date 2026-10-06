import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant, requireMessAdmin } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { auditService } from './audit.service';
import { auditQuerySchema } from './audit.schema';

const router = Router({ mergeParams: true });
router.get('/', authenticate, resolveTenant, requireMessAdmin, validate(auditQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await auditService.list(req.tenant.messId, auditQuerySchema.parse(req.query)) });
    } catch (error) {
      next(error);
    }
  });

export { router as auditRouter };
