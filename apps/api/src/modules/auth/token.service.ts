import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { JwtPayload, AuthTokens } from '@messmess/types';
import { UnauthorizedError } from '../../lib/errors';

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

export class TokenService {
  generateAccessToken(payload: { userId: string; email: string }): AuthTokens {
    const accessToken = jwt.sign(
      { sub: payload.userId, email: payload.email },
      env.JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS },
    );

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  async createRefreshToken(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<string> {
    // Generate a cryptographically secure token
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return rawToken; // Return raw token to be stored in HttpOnly cookie
  }

  async rotateRefreshToken(
    rawToken: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ userId: string; email: string; newRawRefreshToken: string }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // If token not found or already revoked — potential token reuse attack
      // Revoke ALL tokens for this user as a security measure
      if (stored?.userId) {
        await this.revokeAllForUser(stored.userId);
      }
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Revoke the used token (rotation)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Issue new refresh token
    const newRawRefreshToken = await this.createRefreshToken(stored.userId, meta);

    return {
      userId: stored.userId,
      email: stored.user.email,
      newRawRefreshToken,
    };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setRefreshTokenCookie(res: import('express').Response, token: string): void {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      path: '/api/v1/auth',
    });
  }

  clearRefreshTokenCookie(res: import('express').Response): void {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  }
}

export const tokenService = new TokenService();
