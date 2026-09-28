import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { integrationBridgeService } from './integrationBridge.service';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { ShopOrderStatus, IntegrationEventType, AuditAction } from '@messmess/types';
import type { CreateShopOrderDto, ReplaceOrderLinesDto, RecordDeliveryDto } from './shopOrder.schema';

const PRE_PROCESSING_STATUSES: ShopOrderStatus[] = [
  ShopOrderStatus.DRAFT,
  ShopOrderStatus.PLACED,
  ShopOrderStatus.CONFIRMED,
];

class ShopOrderService {
  // ─── Manager side ───────────────────────────────────────────────────────────

  /** Builds order lines with an immutable price snapshot captured NOW. */
  private async buildOrderLines(shopId: string, orderLines: { productId: string; quantity: number }[]) {
    const productIds = orderLines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId, isActive: true },
    });
    if (products.length !== new Set(productIds).size) {
      throw new NotFoundError('One or more active Products in this Shop');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalAmount = new Prisma.Decimal(0);
    const lineData = orderLines.map((line) => {
      const product = productMap.get(line.productId)!;
      const unitPrice = new Prisma.Decimal(product.basePrice);
      totalAmount = totalAmount.add(unitPrice.mul(line.quantity));
      return {
        productId: line.productId,
        productNameSnapshot: product.name,
        unitPriceSnapshot: unitPrice,
        quantity: line.quantity,
      };
    });

    return { lineData, totalAmount };
  }

  async createOrder(messId: string, managerUserId: string, dto: CreateShopOrderDto) {
    const messShopLink = await prisma.messShopLink.findFirst({ where: { messId, isDefault: true } });
    if (!messShopLink) {
      throw new ConflictError('No default Shop is linked to this Mess yet');
    }

    const { lineData, totalAmount } = await this.buildOrderLines(messShopLink.shopId, dto.orderLines);

    const order = await prisma.shopOrder.create({
      data: {
        shopId: messShopLink.shopId,
        messId,
        placedBy: managerUserId,
        status: ShopOrderStatus.DRAFT,
        totalAmount,
        notes: dto.notes,
        orderLines: { create: lineData },
      },
      include: { orderLines: true },
    });

    await auditService.log({
      messId,
      actorUserId: managerUserId,
      action: AuditAction.SHOP_ORDER_CREATED,
      targetType: 'ShopOrder',
      targetId: order.id,
      newState: { totalAmount: totalAmount.toString(), lineCount: lineData.length },
    });

    return order;
  }

  /** Full-replace of line items — only while still DRAFT. */
  async replaceOrderLines(
    messId: string,
    managerUserId: string,
    orderId: string,
    dto: ReplaceOrderLinesDto,
  ) {
    const order = await this.getOwnedOrderOrThrow(messId, orderId, managerUserId);
    if (order.status !== ShopOrderStatus.DRAFT) {
      throw new ConflictError('Line items can only be changed while the order is DRAFT');
    }

    const { lineData, totalAmount } = await this.buildOrderLines(order.shopId, dto.orderLines);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.shopOrderLine.deleteMany({ where: { orderId } });
      return tx.shopOrder.update({
        where: { id: orderId },
        data: { totalAmount, orderLines: { create: lineData } },
        include: { orderLines: true },
      });
    });

    return updated;
  }

  /** DRAFT -> PLACED. Locks the order in — no further line changes after this. */
  async placeOrder(messId: string, managerUserId: string, orderId: string) {
    const order = await this.getOwnedOrderOrThrow(messId, orderId, managerUserId);
    if (order.status !== ShopOrderStatus.DRAFT) {
      throw new ConflictError('Only a DRAFT order can be placed');
    }

    const updated = await prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: ShopOrderStatus.PLACED, placedAt: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: managerUserId,
      action: AuditAction.SHOP_ORDER_PLACED,
      targetType: 'ShopOrder',
      targetId: orderId,
      newState: { totalAmount: order.totalAmount.toString() },
    });

    return updated;
  }

  /** Manager or Shop Admin cancels — only before PROCESSING starts. */
  async cancelOrder(messId: string, actorUserId: string, orderId: string, reason: string) {
    const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    if (!order || order.messId !== messId) throw new NotFoundError('ShopOrder');
    if (!PRE_PROCESSING_STATUSES.includes(order.status)) {
      throw new ConflictError(
        'Only a DRAFT, PLACED, or CONFIRMED order can be cancelled — it has already started processing',
      );
    }

    const updated = await prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: ShopOrderStatus.CANCELLED, notes: reason },
    });

    await auditService.log({
      messId,
      actorUserId,
      action: AuditAction.SHOP_ORDER_CANCELLED,
      targetType: 'ShopOrder',
      targetId: orderId,
      notes: reason,
    });

    return updated;
  }

  async listOrdersForMess(messId: string, status?: ShopOrderStatus) {
    return prisma.shopOrder.findMany({
      where: { messId, ...(status && { status }) },
      include: { orderLines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(messId: string, orderId: string) {
    const order = await prisma.shopOrder.findUnique({
      where: { id: orderId },
      include: { orderLines: true, integrationRecords: true },
    });
    if (!order || order.messId !== messId) throw new NotFoundError('ShopOrder');
    return order;
  }

  private async getOwnedOrderOrThrow(messId: string, orderId: string, managerUserId: string) {
    const order = await prisma.shopOrder.findUnique({ where: { id: orderId } });
    if (!order || order.messId !== messId) throw new NotFoundError('ShopOrder');
    if (order.placedBy !== managerUserId) {
      throw new ForbiddenError('Only the Manager who placed this order can modify it');
    }
    return order;
  }

  // ─── Shop Admin side ────────────────────────────────────────────────────────

  async listOrdersForShop(shopId: string, status?: ShopOrderStatus) {
    return prisma.shopOrder.findMany({
      where: { shopId, ...(status && { status }) },
      include: { orderLines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShopOrder(shopId: string, orderId: string) {
    const order = await prisma.shopOrder.findUnique({
      where: { id: orderId },
      include: { orderLines: true, integrationRecords: true },
    });
    if (!order || order.shopId !== shopId) throw new NotFoundError('ShopOrder');
    return order;
  }

  async confirmOrder(shopId: string, shopAdminUserId: string, orderId: string) {
    const order = await this.getShopOrder(shopId, orderId);
    if (order.status !== ShopOrderStatus.PLACED) {
      throw new ConflictError('Only a PLACED order can be confirmed');
    }

    const updated = await prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: ShopOrderStatus.CONFIRMED },
    });

    await auditService.log({
      messId: order.messId,
      actorUserId: shopAdminUserId,
      action: AuditAction.SHOP_ORDER_STATUS_CHANGED,
      targetType: 'ShopOrder',
      targetId: orderId,
      newState: { status: 'CONFIRMED' },
    });

    return updated;
  }

  async startProcessing(shopId: string, shopAdminUserId: string, orderId: string) {
    const order = await this.getShopOrder(shopId, orderId);
    if (order.status !== ShopOrderStatus.CONFIRMED) {
      throw new ConflictError('Only a CONFIRMED order can move to PROCESSING');
    }

    const updated = await prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: ShopOrderStatus.PROCESSING },
    });

    await auditService.log({
      messId: order.messId,
      actorUserId: shopAdminUserId,
      action: AuditAction.SHOP_ORDER_STATUS_CHANGED,
      targetType: 'ShopOrder',
      targetId: orderId,
      newState: { status: 'PROCESSING' },
    });

    return updated;
  }

  /**
   * Records one delivery batch: increments each line's cumulative
   * deliveredQuantity, computes the INCREMENTAL value of this batch, updates
   * ShopOrder.status (PARTIALLY_DELIVERED vs DELIVERED depending on whether
   * every line is now fully delivered), and hands the incremental amount to
   * the Integration Bridge under a freshly generated fulfillmentEventId.
   */
  async recordDelivery(
    shopId: string,
    shopAdminUserId: string,
    orderId: string,
    dto: RecordDeliveryDto,
  ) {
    const order = await prisma.shopOrder.findUnique({
      where: { id: orderId },
      include: { orderLines: true },
    });
    if (!order || order.shopId !== shopId) throw new NotFoundError('ShopOrder');
    if (
      order.status !== ShopOrderStatus.PROCESSING &&
      order.status !== ShopOrderStatus.PARTIALLY_DELIVERED
    ) {
      throw new ConflictError('Only a PROCESSING or PARTIALLY_DELIVERED order can receive a delivery');
    }

    const lineMap = new Map(order.orderLines.map((l) => [l.id, l]));
    let incrementalAmount = new Prisma.Decimal(0);

    for (const input of dto.lines) {
      const line = lineMap.get(input.orderLineId);
      if (!line || line.orderId !== orderId) {
        throw new NotFoundError(`Order line ${input.orderLineId}`);
      }
      const newCumulative = new Prisma.Decimal(line.deliveredQuantity).add(input.deliveredQuantity);
      if (newCumulative.gt(line.quantity)) {
        throw new ConflictError(
          `Delivered quantity for line ${input.orderLineId} would exceed the ordered quantity`,
        );
      }
      incrementalAmount = incrementalAmount.add(
        new Prisma.Decimal(line.unitPriceSnapshot).mul(input.deliveredQuantity),
      );
    }

    const fulfillmentEventId = `delivery-${Date.now()}-${orderId.slice(-6)}`;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const input of dto.lines) {
        await tx.shopOrderLine.update({
          where: { id: input.orderLineId },
          data: { deliveredQuantity: { increment: input.deliveredQuantity } },
        });
      }

      const refreshedLines = await tx.shopOrderLine.findMany({ where: { orderId } });
      const allFullyDelivered = refreshedLines.every((l) =>
        new Prisma.Decimal(l.deliveredQuantity).gte(l.quantity),
      );
      const newStatus = allFullyDelivered
        ? ShopOrderStatus.DELIVERED
        : ShopOrderStatus.PARTIALLY_DELIVERED;

      return tx.shopOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          deliveredAmount: { increment: incrementalAmount },
          deliveredAt: newStatus === ShopOrderStatus.DELIVERED ? new Date() : order.deliveredAt,
          notes: dto.notes ?? order.notes,
        },
      });
    });

    await auditService.log({
      messId: order.messId,
      actorUserId: shopAdminUserId,
      action: AuditAction.SHOP_ORDER_DELIVERED,
      targetType: 'ShopOrder',
      targetId: orderId,
      newState: { status: updatedOrder.status, incrementalAmount: incrementalAmount.toString() },
    });

    const integrationRecord = await integrationBridgeService.processFulfillmentEvent({
      shopOrderId: orderId,
      fulfillmentEventId,
      eventType:
        updatedOrder.status === ShopOrderStatus.DELIVERED
          ? IntegrationEventType.ORDER_DELIVERED
          : IntegrationEventType.PARTIALLY_DELIVERED,
      deliveredAmount: incrementalAmount.toNumber(),
      triggeredByUserId: shopAdminUserId,
    });

    return { order: updatedOrder, integrationRecord };
  }

  async refundOrder(
    shopId: string,
    shopAdminUserId: string,
    orderId: string,
    refundAmount: number,
    reason: string,
  ) {
    const order = await this.getShopOrder(shopId, orderId);
    if (
      order.status !== ShopOrderStatus.DELIVERED &&
      order.status !== ShopOrderStatus.PARTIALLY_DELIVERED
    ) {
      throw new ConflictError('Refunds only apply to a DELIVERED or PARTIALLY_DELIVERED order');
    }

    const fulfillmentEventId = `refund-${Date.now()}-${orderId.slice(-6)}`;
    const integrationRecord = await integrationBridgeService.processRefundEvent({
      shopOrderId: orderId,
      fulfillmentEventId,
      refundAmount,
      reason,
      triggeredByUserId: shopAdminUserId,
    });

    return { integrationRecord };
  }
}

export const shopOrderService = new ShopOrderService();
