import { prisma } from './prisma';
import { logger } from './logger';
import { AuditAction } from '@messmess/types';

interface AuditLogParams {
  messId?: string;
  actorUserId: string;
  actorRole?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

/**
 * Centralized audit logging service.
 * AuditLog is append-only — this service never updates or deletes records.
 * Failures are logged but never thrown — audit should not break primary operations.
 */
class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          messId: params.messId ?? null,
          actorUserId: params.actorUserId,
          actorRole: params.actorRole ?? null,
          action: params.action,
          targetType: params.targetType ?? null,
          targetId: params.targetId ?? null,
          previousState: params.previousState ?? undefined,
          newState: params.newState ?? undefined,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          notes: params.notes ?? null,
        },
      });
    } catch (err) {
      // Audit failures must not break business operations
      logger.error({ err, params }, 'Failed to write audit log');
    }
  }
}

export const auditService = new AuditService();
