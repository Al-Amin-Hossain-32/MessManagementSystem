import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { periodService } from '../accounting/period.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import {
  ExpenseSourceType,
  ExpenseStatus,
  IntegrationEventType,
  IntegrationProcessingStatus,
  AuditAction,
} from '@messmess/types';

interface FulfillmentEventPayload {
  shopOrderId: string;
  fulfillmentEventId: string;
  eventType: typeof IntegrationEventType.ORDER_DELIVERED | typeof IntegrationEventType.PARTIALLY_DELIVERED;
  /** The INCREMENTAL value delivered in this one batch — not cumulative. */
  deliveredAmount: number;
  triggeredByUserId: string;
}

interface RefundEventPayload {
  shopOrderId: string;
  fulfillmentEventId: string;
  refundAmount: number;
  reason: string;
  triggeredByUserId: string;
}

class IntegrationBridgeService {
  /**
   * Processes an ORDER_DELIVERED / PARTIALLY_DELIVERED fulfillment event.
   * Idempotent on (shopOrderId, fulfillmentEventId) — a retried/duplicated
   * event returns the existing IntegrationRecord instead of double-creating
   * an Expense (SRS §21).
   */
  async processFulfillmentEvent(payload: FulfillmentEventPayload) {
    const idempotencyKey = `${payload.shopOrderId}:${payload.fulfillmentEventId}`;

    const existing = await prisma.integrationRecord.findUnique({ where: { idempotencyKey } });
    if (existing) return existing; // SKIPPED semantics — already processed, no duplicate Expense

    const shopOrder = await prisma.shopOrder.findUnique({ where: { id: payload.shopOrderId } });
    if (!shopOrder) throw new NotFoundError('ShopOrder');

    const messShopLink = await prisma.messShopLink.findUnique({
      where: { messId_shopId: { messId: shopOrder.messId, shopId: shopOrder.shopId } },
    });

    if (!messShopLink?.defaultExpenseCategoryId) {
      // Expected failure mode, not an exception: the Mess Admin has not
      // configured which ExpenseCategory Shop purchases should post to.
      // The full payload is stashed in errorLog so retryIntegration can
      // replay it later without the caller re-supplying anything.
      return this.recordFailure(shopOrder.messId, payload.eventType, idempotencyKey, payload, {
        reason:
          'No defaultExpenseCategoryId configured on MessShopLink for this Mess+Shop. Set one via PATCH /messes/:messId/shop-link, then retry.',
      });
    }

    return this.createDraftExpenseAndRecord(
      shopOrder,
      messShopLink.defaultExpenseCategoryId,
      payload,
    );
  }

  private async createDraftExpenseAndRecord(
    shopOrder: { id: string; messId: string; placedBy: string },
    categoryId: string,
    payload: FulfillmentEventPayload,
  ) {
    const idempotencyKey = `${payload.shopOrderId}:${payload.fulfillmentEventId}`;
    const period = await periodService.getOrCreateActivePeriod(
      shopOrder.messId,
      payload.triggeredByUserId,
    );

    const record = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          messId: shopOrder.messId,
          accountingPeriodId: period.id,
          categoryId,
          sourceType: ExpenseSourceType.LINKED_SHOP,
          sourceShopOrderId: shopOrder.id,
          amount: payload.deliveredAmount,
          description: `Shop delivery — order ${shopOrder.id.slice(-8)}`,
          date: new Date(),
          status: ExpenseStatus.DRAFT_FROM_SHOP,
          // The Manager who placed the order is the natural "recorder" from
          // the Mess's point of view — not the Shop Admin, who Mess members
          // have no visibility into.
          recordedBy: shopOrder.placedBy,
        },
      });

      return tx.integrationRecord.create({
        data: {
          shopOrderId: payload.shopOrderId,
          fulfillmentEventId: payload.fulfillmentEventId,
          eventType: payload.eventType,
          messId: shopOrder.messId,
          messExpenseId: expense.id,
          idempotencyKey,
          processingStatus: IntegrationProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    });

    await auditService.log({
      messId: shopOrder.messId,
      actorUserId: payload.triggeredByUserId,
      action: AuditAction.INTEGRATION_PROCESSED,
      targetType: 'IntegrationRecord',
      targetId: record.id,
      newState: { deliveredAmount: payload.deliveredAmount },
    });

    return record;
  }

  /**
   * Processes a REFUND_ISSUED event. Attributes the refund to the most
   * recently PROCESSED delivery-linked Expense for this order — a
   * documented V1 simplification when an order has multiple partial
   * deliveries (SRS does not specify finer attribution).
   */
  async processRefundEvent(payload: RefundEventPayload) {
    const idempotencyKey = `${payload.shopOrderId}:${payload.fulfillmentEventId}`;

    const existing = await prisma.integrationRecord.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const shopOrder = await prisma.shopOrder.findUnique({ where: { id: payload.shopOrderId } });
    if (!shopOrder) throw new NotFoundError('ShopOrder');

    const linkedRecord = await prisma.integrationRecord.findFirst({
      where: {
        shopOrderId: payload.shopOrderId,
        eventType: { in: [IntegrationEventType.ORDER_DELIVERED, IntegrationEventType.PARTIALLY_DELIVERED] },
        processingStatus: IntegrationProcessingStatus.PROCESSED,
        messExpenseId: { not: null },
      },
      orderBy: { processedAt: 'desc' },
    });

    if (!linkedRecord?.messExpenseId) {
      return this.recordFailure(
        shopOrder.messId,
        IntegrationEventType.REFUND_ISSUED,
        idempotencyKey,
        payload,
        { reason: 'No delivery-linked Expense found for this order to refund against' },
      );
    }

    const linkedExpense = await prisma.expense.findUniqueOrThrow({
      where: { id: linkedRecord.messExpenseId },
    });

    if (new Prisma.Decimal(payload.refundAmount).gt(linkedExpense.amount)) {
      throw new ConflictError('Refund amount exceeds the linked Expense amount');
    }

    return this.applyRefundToExpense(shopOrder, linkedExpense, payload);
  }

  private async applyRefundToExpense(
    shopOrder: { id: string; messId: string; refundedAmount: Prisma.Decimal },
    linkedExpense: Prisma.ExpenseGetPayload<Record<string, never>>,
    payload: RefundEventPayload,
  ) {
    const idempotencyKey = `${payload.shopOrderId}:${payload.fulfillmentEventId}`;
    const newAmount = new Prisma.Decimal(linkedExpense.amount).sub(payload.refundAmount);

    const record = await prisma.$transaction(async (tx) => {
      let resultingExpenseId: string | null = null;

      if (linkedExpense.status === ExpenseStatus.DRAFT_FROM_SHOP) {
        // Still a draft — safe to adjust the amount in place; nothing has
        // been confirmed into accounting yet. This event does NOT own a
        // distinct new Expense, so messExpenseId stays null below —
        // IntegrationRecord.messExpenseId is @unique, and the original
        // delivery's IntegrationRecord already points at this same Expense.
        await tx.expense.update({ where: { id: linkedExpense.id }, data: { amount: newAmount } });
      } else if (linkedExpense.status === ExpenseStatus.ACTIVE) {
        // Already confirmed — SRS §21: "original Expense never modified
        // directly". Reverse it and create a new corrected Expense, exactly
        // the pattern expenseService.reverseExpense already establishes.
        // This new Expense is distinct, so it's safe to link here.
        const corrected = await tx.expense.create({
          data: {
            messId: linkedExpense.messId,
            accountingPeriodId: linkedExpense.accountingPeriodId,
            categoryId: linkedExpense.categoryId,
            sourceType: ExpenseSourceType.LINKED_SHOP,
            sourceShopOrderId: linkedExpense.sourceShopOrderId,
            amount: newAmount,
            description: `${linkedExpense.description} (refund-adjusted)`,
            date: new Date(),
            status: ExpenseStatus.ACTIVE,
            recordedBy: linkedExpense.recordedBy,
            confirmedBy: payload.triggeredByUserId,
            confirmedAt: new Date(),
          },
        });
        await tx.expense.update({
          where: { id: linkedExpense.id },
          data: { status: ExpenseStatus.REVERSED, reversalRef: corrected.id },
        });
        resultingExpenseId = corrected.id;
      } else {
        throw new ConflictError(
          `Cannot refund against an Expense in status ${linkedExpense.status}`,
        );
      }

      await tx.shopOrder.update({
        where: { id: shopOrder.id },
        data: { refundedAmount: { increment: payload.refundAmount } },
      });

      return tx.integrationRecord.create({
        data: {
          shopOrderId: payload.shopOrderId,
          fulfillmentEventId: payload.fulfillmentEventId,
          eventType: IntegrationEventType.REFUND_ISSUED,
          messId: shopOrder.messId,
          messExpenseId: resultingExpenseId,
          idempotencyKey,
          processingStatus: IntegrationProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    });

    await auditService.log({
      messId: shopOrder.messId,
      actorUserId: payload.triggeredByUserId,
      action: AuditAction.SHOP_ORDER_REFUNDED,
      targetType: 'ShopOrder',
      targetId: shopOrder.id,
      notes: payload.reason,
      newState: { refundAmount: payload.refundAmount },
    });

    return record;
  }

  /** Records a FAILED IntegrationRecord, stashing the full payload for retry. */
  private async recordFailure(
    messId: string,
    eventType: IntegrationEventType,
    idempotencyKey: string,
    payload: FulfillmentEventPayload | RefundEventPayload,
    error: { reason: string },
  ) {
    const [shopOrderId, fulfillmentEventId] = idempotencyKey.split(':');
    const failed = await prisma.integrationRecord.create({
      data: {
        shopOrderId,
        fulfillmentEventId,
        eventType,
        messId,
        idempotencyKey,
        processingStatus: IntegrationProcessingStatus.FAILED,
        errorLog: { ...error, payload } as Prisma.InputJsonValue,
      },
    });

    await auditService.log({
      messId,
      actorUserId: payload.triggeredByUserId,
      action: AuditAction.INTEGRATION_FAILED,
      targetType: 'IntegrationRecord',
      targetId: failed.id,
      notes: error.reason,
    });

    return failed;
  }

  /**
   * Admin retries a FAILED IntegrationRecord after fixing its root cause
   * (e.g. setting defaultExpenseCategoryId). Replays the exact payload that
   * was stashed in errorLog at failure time — the caller does not need to
   * re-supply anything.
   */
  async retryIntegration(messId: string, adminUserId: string, integrationRecordId: string) {
    const record = await prisma.integrationRecord.findUnique({ where: { id: integrationRecordId } });
    if (!record || record.messId !== messId) throw new NotFoundError('IntegrationRecord');
    if (record.processingStatus !== IntegrationProcessingStatus.FAILED) {
      throw new ConflictError('Only a FAILED integration record can be retried');
    }

    const errorLog = record.errorLog as { payload?: FulfillmentEventPayload | RefundEventPayload } | null;
    if (!errorLog?.payload) {
      throw new ConflictError(
        'This record has no replayable payload (created before retry support was added)',
      );
    }

    // Delete the failed row before replaying — processFulfillmentEvent /
    // processRefundEvent's idempotency check would otherwise short-circuit
    // on the very row we are trying to replace.
    await prisma.integrationRecord.delete({ where: { id: integrationRecordId } });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.INTEGRATION_RETRIED,
      targetType: 'IntegrationRecord',
      targetId: integrationRecordId,
    });

    if (record.eventType === IntegrationEventType.REFUND_ISSUED) {
      return this.processRefundEvent({
        ...(errorLog.payload as RefundEventPayload),
        triggeredByUserId: adminUserId,
      });
    }

    return this.processFulfillmentEvent({
      ...(errorLog.payload as FulfillmentEventPayload),
      triggeredByUserId: adminUserId,
    });
  }
}

export const integrationBridgeService = new IntegrationBridgeService();
