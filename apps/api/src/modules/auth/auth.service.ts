import argon2 from 'argon2';
import { prisma } from '../../lib/prisma';
import { tokenService } from './token.service';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../lib/errors';
import { AuditAction } from '@messmess/types';
import { auditService } from '../../lib/audit.service';

export interface RegisterDto {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  async register(dto: RegisterDto, meta: { ipAddress?: string; userAgent?: string }) {
    // Check for existing email
    const existingByEmail = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existingByEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    // Check for existing phone if provided
    if (dto.phone) {
      const existingByPhone = await prisma.user.findUnique({
        where: { phone: dto.phone },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictError('An account with this phone number already exists');
      }
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        passwordHash,
        isVerified: false,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    await auditService.log({
      actorUserId: user.id,
      action: AuditAction.USER_REGISTERED,
      targetType: 'User',
      targetId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return user;
  }

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
    });

    // Use constant-time comparison path even on not-found to prevent timing attacks
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=1$dummysalt$dummyhash';
    const passwordToVerify = user?.passwordHash ?? dummyHash;
    const isValid = await argon2.verify(passwordToVerify, dto.password).catch(() => false);

    if (!user || !isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
    }

    const tokens = tokenService.generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = await tokenService.createRefreshToken(user.id, meta);

    await auditService.log({
      actorUserId: user.id,
      action: AuditAction.USER_LOGIN,
      targetType: 'User',
      targetId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name },
      tokens,
      refreshToken,
    };
  }

  async refreshTokens(rawRefreshToken: string, meta: { ipAddress?: string; userAgent?: string }) {
    const { userId, email, newRawRefreshToken } = await tokenService.rotateRefreshToken(
      rawRefreshToken,
      meta,
    );

    const tokens = tokenService.generateAccessToken({ userId, email });

    return { tokens, newRawRefreshToken };
  }

  async logout(rawRefreshToken: string, userId: string, meta: { ipAddress?: string; userAgent?: string }) {
    await tokenService.revokeRefreshToken(rawRefreshToken);

    await auditService.log({
      actorUserId: userId,
      action: AuditAction.USER_LOGOUT,
      targetType: 'User',
      targetId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }
}

export const authService = new AuthService();
