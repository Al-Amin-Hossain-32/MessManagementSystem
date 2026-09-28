import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { integrationBridgeService } from './integrationBridge.service';
import { NotFoundError } from '../../lib/errors';
import { AuditAction, IntegrationProcessingStatus } from '@messmess/types';

class MessShopLinkService {
  async getLink(messId: string) {
    return prisma.messShopLink.findFirst({ where: { messId, isDefault: true } });
  }

  async setDefaultExpenseCategory(messId: string, adminUserId: string, categoryId: string) {
    const link = await prisma.messShopLink.findFirst({ where: { messId, isDefault: true } });
    if (!link) throw new NotFoundError('MessShopLink — this Mess has no linked Shop yet');

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category || category.messId !== messId) {
      throw new NotFoundError('Expense category belonging to this Mess');
    }

    const updated = await prisma.messShopLink.update({
      where: { id: link.id },
      data: { defaultExpenseCategoryId: categoryId },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.MESS_SHOP_LINK_UPDATED,
      targetType: 'MessShopLink',
      targetId: link.id,
      newState: { defaultExpenseCategoryId: categoryId },
    });

    return updated;
  }

  async listFailedIntegrations(messId: string) {
    return prisma.integrationRecord.findMany({
      where: { messId, processingStatus: IntegrationProcessingStatus.FAILED },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retryIntegration(messId: string, adminUserId: string, integrationRecordId: string) {
    return integrationBridgeService.retryIntegration(messId, adminUserId, integrationRecordId);
  }
}

export const messShopLinkService = new MessShopLinkService();
