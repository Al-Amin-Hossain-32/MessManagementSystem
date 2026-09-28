import { z } from 'zod';

const orderLineInputSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().positive('quantity must be greater than 0'),
});

export const createShopOrderSchema = z.object({
  orderLines: z.array(orderLineInputSchema).min(1, 'At least one line item is required'),
  notes: z.string().max(500).optional(),
});

// Full-replace of line items, only while the order is still DRAFT.
export const replaceOrderLinesSchema = z.object({
  orderLines: z.array(orderLineInputSchema).min(1, 'At least one line item is required'),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3, 'A cancellation reason is required').max(500),
});

const deliveryLineInputSchema = z.object({
  orderLineId: z.string().cuid(),
  // Incremental quantity delivered in THIS batch — added to the line's
  // existing cumulative deliveredQuantity, not a new total.
  deliveredQuantity: z.number().positive(),
});

export const recordDeliverySchema = z.object({
  lines: z.array(deliveryLineInputSchema).min(1, 'At least one delivered line is required'),
  notes: z.string().max(500).optional(),
});

export const refundOrderSchema = z.object({
  refundAmount: z.number().positive(),
  reason: z.string().min(3, 'A refund reason is required').max(500),
});

export type CreateShopOrderDto = z.infer<typeof createShopOrderSchema>;
export type ReplaceOrderLinesDto = z.infer<typeof replaceOrderLinesSchema>;
export type RecordDeliveryDto = z.infer<typeof recordDeliverySchema>;
export type RefundOrderDto = z.infer<typeof refundOrderSchema>;
