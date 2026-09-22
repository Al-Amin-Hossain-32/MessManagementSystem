import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { AuditAction } from '@messmess/types';
import type { UpsertGuestMealConfigDto } from './guestMeal.schema';

class GuestMealConfigService {
  async getConfig(messId: string) {
    return prisma.messGuestMealConfig.findUnique({ where: { messId } });
  }

  async upsertConfig(messId: string, adminUserId: string, dto: UpsertGuestMealConfigDto) {
    const config = await prisma.messGuestMealConfig.upsert({
      where: { messId },
      create: { messId, ...dto },
      update: { ...dto, effectiveFrom: new Date() },
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.MEAL_CONFIG_UPDATED,
      targetType: 'MessGuestMealConfig',
      targetId: config.id,
      newState: dto,
    });

    return config;
  }
}

export const guestMealConfigService = new GuestMealConfigService();
