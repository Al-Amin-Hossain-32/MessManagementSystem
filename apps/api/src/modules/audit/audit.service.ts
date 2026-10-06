import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { auditQuerySchema } from './audit.schema';

type AuditQuery = z.infer<typeof auditQuerySchema>;

class AuditService {
  async list(messId: string, query: AuditQuery) {
    const to = query.to ? new Date(query.to) : undefined;
    to?.setUTCHours(23, 59, 59, 999);
    const where = {
      messId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.from || query.to ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(to ? { lte: to } : {}),
        },
      } : {}),
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true, action: true, targetType: true, targetId: true, previousState: true, newState: true,
          notes: true, createdAt: true, actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { logs, total, page: query.page, limit: query.limit, hasMore: query.page * query.limit < total };
  }
}

export const auditService = new AuditService();
