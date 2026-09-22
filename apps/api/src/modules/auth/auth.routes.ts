import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema } from './auth.schema';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), authController.register.bind(authController));

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), authController.login.bind(authController));

// POST /api/v1/auth/refresh  (uses HttpOnly cookie)
router.post('/refresh', authController.refresh.bind(authController));

// POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout.bind(authController));

// GET /api/v1/auth/me
router.get('/me', authenticate, authController.me.bind(authController));

export { router as authRouter };
