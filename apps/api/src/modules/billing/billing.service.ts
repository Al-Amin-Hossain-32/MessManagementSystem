import { BillingPaymentRequestStatus, AuditAction, SubscriptionStatus } from '@messmess/types';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { ConflictError, NotFoundError } from '../../lib/errors';
import type { z } from 'zod';
import { createBillingRequestSchema, listBillingRequestsSchema } from './billing.schema';

type CreateBillingRequest = z.infer<typeof createBillingRequestSchema>;
type ListBillingRequests = z.infer<typeof listBillingRequestsSchema>;

const requestInclude = {
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
} as const;

class BillingService {
  async getMessBilling(messId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { messId },
      include: { billingAccount: { select: { billingEmail: true, status: true } } },
    });
    if (!subscription) throw new NotFoundError('Mess subscription');
    return { subscription };
  }

  async createRequest(messId: string, actorUserId: string, dto: CreateBillingRequest) {
    const subscription = await prisma.subscription.findUnique({ where: { messId }, select: { id: true } });
    if (!subscription) throw new NotFoundError('Mess subscription');
    const pending = await prisma.billingPaymentRequest.findFirst({
      where: { messId, status: BillingPaymentRequestStatus.PENDING },
      select: { id: true },
    });
    if (pending) throw new ConflictError('A billing payment request is already awaiting review');

    const request = await prisma.billingPaymentRequest.create({
      data: { messId, requestedBy: actorUserId, ...dto },
      include: requestInclude,
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('This payment reference already exists or a request is already awaiting review');
      }
      throw error;
    });
    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.BILLING_PAYMENT_SUBMITTED,
      targetType: 'BillingPaymentRequest',
      targetId: request.id,
      newState: { plan: request.plan, amount: request.amount.toString(), method: request.method },
    });
    return request;
  }

  async listMessRequests(messId: string, query: ListBillingRequests) {
    const where = { messId, ...(query.status ? { status: query.status } : {}) };
    const [requests, total] = await Promise.all([
      prisma.billingPaymentRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.billingPaymentRequest.count({ where }),
    ]);
    return { requests, total, page: query.page, limit: query.limit, hasMore: query.page * query.limit < total };
  }

  async listPlatformRequests(query: ListBillingRequests) {
    const where = query.status ? { status: query.status } : {};
    const [requests, total] = await Promise.all([
      prisma.billingPaymentRequest.findMany({
        where,
        include: { ...requestInclude, mess: { select: { id: true, name: true } } },
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.billingPaymentRequest.count({ where }),
    ]);
    return { requests, total, page: query.page, limit: query.limit, hasMore: query.page * query.limit < total };
  }

  async approveRequest(requestId: string, reviewerId: string) {
    const request = await prisma.billingPaymentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError('Billing payment request');
    if (request.status !== BillingPaymentRequestStatus.PENDING) throw new ConflictError('This request has already been reviewed');

    const reviewedAt = new Date();
    const currentPeriodEnd = new Date(reviewedAt);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.billingPaymentRequest.updateMany({
        where: { id: requestId, status: BillingPaymentRequestStatus.PENDING },
        data: { status: BillingPaymentRequestStatus.APPROVED, reviewedBy: reviewerId, reviewedAt },
      });
      if (updated.count !== 1) throw new ConflictError('This request has already been reviewed');
      const subscription = await tx.subscription.update({
        where: { messId: request.messId },
        data: {
          plan: request.plan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: reviewedAt,
          currentPeriodEnd,
          trialEndsAt: null,
          cancelledAt: null,
          cancelReason: null,
        },
      });
      return { subscription, request: await tx.billingPaymentRequest.findUniqueOrThrow({ where: { id: requestId }, include: requestInclude }) };
    });

    await auditService.log({
      messId: request.messId,
      actorUserId: reviewerId,
      action: AuditAction.BILLING_PAYMENT_APPROVED,
      targetType: 'BillingPaymentRequest',
      targetId: requestId,
      newState: { plan: result.subscription.plan, amount: request.amount.toString(), currentPeriodEnd },
    });
    return result;
  }

  async rejectRequest(requestId: string, reviewerId: string, reason: string) {
    const existing = await prisma.billingPaymentRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundError('Billing payment request');
    if (existing.status !== BillingPaymentRequestStatus.PENDING) throw new ConflictError('This request has already been reviewed');
    const result = await prisma.billingPaymentRequest.updateMany({
      where: { id: requestId, status: BillingPaymentRequestStatus.PENDING },
      data: {
        status: BillingPaymentRequestStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });
    if (result.count !== 1) throw new ConflictError('This request has already been reviewed');
    const request = await prisma.billingPaymentRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: requestInclude,
    });
    await auditService.log({
      messId: existing.messId,
      actorUserId: reviewerId,
      action: AuditAction.BILLING_PAYMENT_REJECTED,
      targetType: 'BillingPaymentRequest',
      targetId: requestId,
      newState: { reason },
    });
    return request;
  }
}

export const billingService = new BillingService();
