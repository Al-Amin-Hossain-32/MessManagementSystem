import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authenticate } from '../../middleware/authenticate';
import { resolveTenant, resolveTenantLoose, requirePrimaryOwner } from '../../middleware/resolveTenant';
import { validate } from '../../middleware/validate';
import { directorService } from './director.service';
import { directorIdSchema, inviteDirectorSchema, suspendDirectorSchema } from './director.schema';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', resolveTenant, requirePrimaryOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { directors: await directorService.list(req.tenant.messId) } });
  } catch (error) { next(error); }
});

router.post('/', resolveTenant, requirePrimaryOwner, validate(inviteDirectorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const director = await directorService.invite(req.tenant.messId, req.auth.userId, req.body.email);
    res.status(StatusCodes.CREATED).json({ success: true, data: { director } });
  } catch (error) { next(error); }
});

router.post('/:relationshipId/accept', resolveTenantLoose, validate(directorIdSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { director: await directorService.respond(req.tenant.messId, req.params.relationshipId, req.auth.userId, true) } });
  } catch (error) { next(error); }
});

router.post('/:relationshipId/decline', resolveTenantLoose, validate(directorIdSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { director: await directorService.respond(req.tenant.messId, req.params.relationshipId, req.auth.userId, false) } });
  } catch (error) { next(error); }
});

router.patch('/:relationshipId/suspend', resolveTenant, requirePrimaryOwner, validate(directorIdSchema, 'params'), validate(suspendDirectorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { director: await directorService.setStatus(req.tenant.messId, req.params.relationshipId, req.auth.userId, 'suspend', req.body.reason) } });
  } catch (error) { next(error); }
});

router.patch('/:relationshipId/reactivate', resolveTenant, requirePrimaryOwner, validate(directorIdSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { director: await directorService.setStatus(req.tenant.messId, req.params.relationshipId, req.auth.userId, 'reactivate') } });
  } catch (error) { next(error); }
});

router.delete('/:relationshipId', resolveTenant, requirePrimaryOwner, validate(directorIdSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: { director: await directorService.setStatus(req.tenant.messId, req.params.relationshipId, req.auth.userId, 'revoke') } });
  } catch (error) { next(error); }
});

export { router as directorRouter };
