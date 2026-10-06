import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { periodService } from '../accounting/period.service';
import { NotFoundError, ConflictError, ForbiddenError, SelfApprovalError } from '../../lib/errors';
import {
  BoarderMembershipStatus,
  ExpenseStatus,
  PaymentMethod,
  PaymentChannel,
  PaymentStatus,
  AuditAction,
  NotificationType,
} from '@messmess/types';
import type { RecordCashPaymentDto, SubmitDigitalPaymentDto } from './payment.schema';
import { notificationService } from '../notification/notification.service';

class PaymentService {
  // ─── Cash Payment Flow ──────────────────────────────────────────────────────

  /** Manager/Admin records a cash payment received from a Boarder. */
  async recordCashPayment(messId: string, actorUserId: string, dto: RecordCashPaymentDto) {
    const boarder = await prisma.boarderMembership.findUnique({
      where: { id: dto.boarderMembershipId },
    });
    if (!boarder || boarder.messId !== messId || boarder.status !== BoarderMembershipStatus.ACTIVE) {
      throw new NotFoundError('Active Boarder');
    }

    const period = await periodService.getOrCreateActivePeriod(messId, actorUserId);

    const payment = await prisma.payment.create({
      data: {
        messId,
        boarderMembershipId: dto.boarderMembershipId,
        accountingPeriodId: period.id,
        amount: dto.amount,
        method: PaymentMethod.CASH,
        channel: PaymentChannel.CASH_CHANNEL,
        status: PaymentStatus.PENDING_CONFIRMATION,
        initiatedBy: actorUserId,
        notes: dto.notes,
      },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.PAYMENT_SUBMITTED,
      targetType: 'Payment',
      targetId: payment.id,
      newState: { amount: dto.amount, channel: PaymentChannel.CASH_CHANNEL },
    });

    await notificationService.notifyUser({
      userId: boarder.userId,
      messId,
      eventId: `payment.recorded:${payment.id}`,
      type: NotificationType.PAYMENT_RECORDED,
      href: `/mess/${messId}/payments`,
      params: { amount: payment.amount.toString() },
    });

    return payment;
  }

  /**
   * Boarder confirms a CASH payment recorded against them.
   * Self-approval blocked (SRS §16): if the Manager who recorded it is the
   * same person as the paying Boarder, they cannot self-confirm — an
   * independent Admin must verify instead (see adminResolvePayment).
   */
  async confirmCashPayment(messId: string, actorUserId: string, paymentId: string) {
    const payment = await this.getPaymentOrThrow(messId, paymentId);
    if (payment.channel !== PaymentChannel.CASH_CHANNEL) {
      throw new ConflictError('Only a cash payment can be confirmed this way');
    }
    if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
      throw new ConflictError('This payment is no longer pending confirmation');
    }
    if (payment.boarderMembership.userId !== actorUserId) {
      throw new ForbiddenError('Only the paying Boarder can confirm this payment');
    }
    if (payment.initiatedBy === actorUserId) {
      throw new SelfApprovalError(
        'confirming a cash payment you recorded for yourself — ask a Mess Admin to verify it instead',
      );
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CONFIRMED, confirmedBy: actorUserId, confirmedAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.PAYMENT_CONFIRMED,
      targetType: 'Payment',
      targetId: updated.id,
    });

    return updated;
  }

  /** Boarder disputes a CASH payment recorded against them. */
  async disputeCashPayment(messId: string, actorUserId: string, paymentId: string, reason: string) {
    const payment = await this.getPaymentOrThrow(messId, paymentId);
    if (payment.channel !== PaymentChannel.CASH_CHANNEL) {
      throw new ConflictError('Only a cash payment can be disputed this way');
    }
    if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
      throw new ConflictError('This payment is no longer pending confirmation');
    }
    if (payment.boarderMembership.userId !== actorUserId) {
      throw new ForbiddenError('Only the paying Boarder can dispute this payment');
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.DISPUTED,
        disputedBy: actorUserId,
        disputedAt: new Date(),
        notes: reason,
      },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.PAYMENT_DISPUTED,
      targetType: 'Payment',
      targetId: updated.id,
      notes: reason,
    });

    return updated;
  }

  // ─── Digital Payment Flow ───────────────────────────────────────────────────

  /** Boarder submits a digital payment for Manager verification. */
  async submitDigitalPayment(messId: string, boarderUserId: string, dto: SubmitDigitalPaymentDto) {
    const membership = await this.requireOwnActiveMembership(messId, boarderUserId);
    const period = await periodService.getOrCreateActivePeriod(messId, boarderUserId);

    try {
      const payment = await prisma.payment.create({
        data: {
          messId,
          boarderMembershipId: membership.id,
          accountingPeriodId: period.id,
          amount: dto.amount,
          method: dto.method,
          channel: PaymentChannel.DIGITAL_CHANNEL,
          status: PaymentStatus.PENDING_CONFIRMATION,
          initiatedBy: boarderUserId,
          transactionRef: dto.transactionRef,
          proofRef: dto.proofRef,
          notes: dto.notes,
        },
      });

      await auditService.log({
        messId,
        actorUserId: boarderUserId,
        action: AuditAction.PAYMENT_SUBMITTED,
        targetType: 'Payment',
        targetId: payment.id,
        newState: {
          amount: dto.amount,
          channel: PaymentChannel.DIGITAL_CHANNEL,
          transactionRef: dto.transactionRef,
        },
      });

      await notificationService.notifyAdmins({
        messId,
        eventId: `payment.submitted:${payment.id}`,
        type: NotificationType.PAYMENT_SUBMITTED,
        href: `/mess/${messId}/payments`,
        params: { amount: payment.amount.toString() },
        excludeUserId: boarderUserId,
      });

      return payment;
    } catch (err: unknown) {
      // SRS §16/§28: unique(messId, transactionRef) — see Phase 2's
      // manual-sql business-constraints migration for the DB-level index.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(
          'This transaction reference has already been submitted for this Mess',
        );
      }
      throw err;
    }
  }

  /**
   * Manager/Admin verifies (confirms or rejects) a DIGITAL payment.
   * Self-approval blocked: the verifier cannot be the same person as the
   * paying Boarder.
   */
  async verifyDigitalPayment(
    messId: string,
    actorUserId: string,
    paymentId: string,
    decision: 'CONFIRMED' | 'REJECTED',
    reason?: string,
  ) {
    const payment = await this.getPaymentOrThrow(messId, paymentId);
    if (payment.channel !== PaymentChannel.DIGITAL_CHANNEL) {
      throw new ConflictError('Only a digital payment can be verified this way');
    }
    if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
      throw new ConflictError('This payment is no longer pending confirmation');
    }
    if (payment.boarderMembership.userId === actorUserId) {
      throw new SelfApprovalError(
        'verifying your own digital payment — ask a Mess Admin to verify it instead',
      );
    }

    if (decision === 'REJECTED') {
      if (!reason) throw new ConflictError('A rejection reason is required');
      const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REJECTED,
          rejectedBy: actorUserId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      });
      await auditService.log({
        messId,
        actorUserId,
        action: AuditAction.PAYMENT_REJECTED,
        targetType: 'Payment',
        targetId: updated.id,
        notes: reason,
      });
      await notificationService.notifyUser({
        userId: payment.boarderMembership.userId,
        messId,
        eventId: `payment.rejected:${updated.id}`,
        type: NotificationType.PAYMENT_REJECTED,
        href: `/mess/${messId}/payments`,
        params: { amount: payment.amount.toString() },
      });
      return updated;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CONFIRMED, confirmedBy: actorUserId, confirmedAt: new Date() },
    });
    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.PAYMENT_CONFIRMED,
      targetType: 'Payment',
      targetId: updated.id,
    });
    await notificationService.notifyUser({
      userId: payment.boarderMembership.userId,
      messId,
      eventId: `payment.confirmed:${updated.id}`,
      type: NotificationType.PAYMENT_CONFIRMED,
      href: `/mess/${messId}/payments`,
      params: { amount: payment.amount.toString() },
    });
    return updated;
  }

  // ─── Admin Resolution & Reversal ────────────────────────────────────────────

  /**
   * Admin-only resolution path, covering two cases the self-service paths
   * deliberately cannot: (1) resolving a DISPUTED payment, and (2)
   * confirming a payment blocked by the self-approval rule (the recorder and
   * the payer/verifier are the same person).
   */
  async adminResolvePayment(
    messId: string,
    adminUserId: string,
    paymentId: string,
    decision: 'CONFIRMED' | 'REJECTED',
    reason?: string,
  ) {
    const payment = await this.getPaymentOrThrow(messId, paymentId);
    if (
      payment.status !== PaymentStatus.DISPUTED &&
      payment.status !== PaymentStatus.PENDING_CONFIRMATION
    ) {
      throw new ConflictError(
        'Only a DISPUTED or PENDING_CONFIRMATION payment can be resolved by an Admin',
      );
    }

    if (decision === 'REJECTED') {
      if (!reason) throw new ConflictError('A rejection reason is required');
      const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REJECTED,
          rejectedBy: adminUserId,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      });
      await auditService.log({
        messId,
        actorUserId: adminUserId,
        action: AuditAction.PAYMENT_REJECTED,
        targetType: 'Payment',
        targetId: updated.id,
        notes: reason,
      });
      await notificationService.notifyUser({
        userId: payment.boarderMembership.userId,
        messId,
        eventId: `payment.rejected:${updated.id}`,
        type: NotificationType.PAYMENT_REJECTED,
        href: `/mess/${messId}/payments`,
        params: { amount: payment.amount.toString() },
      });
      return updated;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.CONFIRMED, confirmedBy: adminUserId, confirmedAt: new Date() },
    });
    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PAYMENT_CONFIRMED,
      targetType: 'Payment',
      targetId: updated.id,
      notes: reason,
    });
    await notificationService.notifyUser({
      userId: payment.boarderMembership.userId,
      messId,
      eventId: `payment.confirmed:${updated.id}`,
      type: NotificationType.PAYMENT_CONFIRMED,
      href: `/mess/${messId}/payments`,
      params: { amount: payment.amount.toString() },
    });
    return updated;
  }

  /**
   * Reverses a CONFIRMED payment (SRS §16: "CONFIRMED payments cannot be
   * deleted. Corrections use REVERSED status + new correcting payment
   * record."). The original row is never deleted or mutated beyond status.
   */
  async reversePayment(
    messId: string,
    adminUserId: string,
    paymentId: string,
    reason: string,
    correctingPaymentId?: string,
  ) {
    const payment = await this.getPaymentOrThrow(messId, paymentId);
    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new ConflictError('Only a CONFIRMED payment can be reversed');
    }

    if (correctingPaymentId) {
      const correcting = await prisma.payment.findUnique({ where: { id: correctingPaymentId } });
      if (!correcting || correcting.messId !== messId) {
        throw new NotFoundError('Correcting payment');
      }
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REVERSED, reversalRef: correctingPaymentId ?? null },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.PAYMENT_REVERSED,
      targetType: 'Payment',
      targetId: updated.id,
      notes: reason,
      newState: { correctingPaymentId },
    });

    return updated;
  }

  // ─── Listing ────────────────────────────────────────────────────────────────

  async listPayments(
    messId: string,
    filters: { accountingPeriodId?: string; status?: PaymentStatus },
  ) {
    return prisma.payment.findMany({
      where: {
        messId,
        ...(filters.accountingPeriodId && { accountingPeriodId: filters.accountingPeriodId }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        boarderMembership: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { initiatedAt: 'desc' },
    });
  }

  async getFundSummary(messId: string) {
    const [payments, expenses] = await Promise.all([
      prisma.payment.aggregate({
        where: { messId, status: PaymentStatus.CONFIRMED },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { messId, status: ExpenseStatus.ACTIVE },
        _sum: { amount: true },
      }),
    ]);
    const collected = new Prisma.Decimal(payments._sum.amount ?? 0);
    const spent = new Prisma.Decimal(expenses._sum.amount ?? 0);
    return { collected, spent, balance: collected.sub(spent) };
  }

  async getPayment(messId: string, paymentId: string) {
    return this.getPaymentOrThrow(messId, paymentId);
  }

  async getMyPayments(messId: string, userId: string) {
    const membership = await this.requireOwnActiveMembership(messId, userId);
    return prisma.payment.findMany({
      where: { messId, boarderMembershipId: membership.id },
      orderBy: { initiatedAt: 'desc' },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async requireOwnActiveMembership(messId: string, userId: string) {
    const membership = await prisma.boarderMembership.findFirst({
      where: { messId, userId, status: BoarderMembershipStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenError('You are not an active Boarder of this Mess');
    return membership;
  }

  private async getPaymentOrThrow(messId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { boarderMembership: true },
    });
    if (!payment || payment.messId !== messId) throw new NotFoundError('Payment');
    return payment;
  }
}

export const paymentService = new PaymentService();
