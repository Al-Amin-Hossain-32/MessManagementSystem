import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../lib/errors';
import { JwtPayload } from '@messmess/types';

// Extend Express Request to carry verified auth context
declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string;
        email: string;
      };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    // Attach verified identity — downstream handlers must NOT read userId from req.body/query
    req.auth = {
      userId: payload.sub,
      email: payload.email,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token has expired'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid access token'));
    } else {
      next(err);
    }
  }
}

/**
 * Optional authentication — attaches auth context if token present, continues if not.
 * Use for routes that have different behaviour for authenticated vs anonymous users.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.auth = { userId: payload.sub, email: payload.email };
  } catch {
    // Invalid token on optional route — continue unauthenticated
  }
  next();
}
