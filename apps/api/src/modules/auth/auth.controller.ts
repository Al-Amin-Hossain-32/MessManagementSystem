import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from './auth.service';
import { tokenService } from './token.service';
import { UnauthorizedError } from '../../lib/errors';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.register(req.body, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { user },
        message: 'Account created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, tokens, refreshToken } = await authService.login(req.body, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      tokenService.setRefreshTokenCookie(res, refreshToken);

      res.status(StatusCodes.OK).json({
        success: true,
        data: { user, tokens },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.['refreshToken'];
      if (!rawRefreshToken) {
        throw new UnauthorizedError('Refresh token not found');
      }

      const { tokens, newRawRefreshToken } = await authService.refreshTokens(rawRefreshToken, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      tokenService.setRefreshTokenCookie(res, newRawRefreshToken);

      res.status(StatusCodes.OK).json({
        success: true,
        data: { tokens },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.['refreshToken'];
      if (!rawRefreshToken) {
        // Already logged out — idempotent
        res.status(StatusCodes.NO_CONTENT).end();
        return;
      }

      await authService.logout(rawRefreshToken, req.auth.userId, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      tokenService.clearRefreshTokenCookie(res);

      res.status(StatusCodes.NO_CONTENT).end();
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { prisma } = await import('../../lib/prisma');
      const user = await prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isVerified: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.status(StatusCodes.OK).json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
