import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { AuditAction } from '@messmess/types';
import type { UpsertMealConfigDto } from './mealConfig.schema';

class MealConfigService {
  async getConfig(messId: string) {
    // null is a valid "not configured yet" state — callers must handle it.
    return prisma.messMealConfig.findUnique({
      where: { messId },
      include: { mealTypes: { orderBy: { type: 'asc' } } },
    });
  }

  /**
   * Creates or fully replaces the Mess's current meal configuration.
   *
   * VERSIONING NOTE: schema.prisma keeps exactly one MessMealConfig row per
   * Mess (messId is @unique) — this is NOT a versioned history table. SRS §13
   * ("Historical months always use the configuration snapshot active during
   * that period") is satisfied at a finer grain instead: every MealRecord
   * freezes its own `weight` at generation time (copied from the active
   * MealTypeConfig), so changing this config later never mutates
   * already-generated MealRecords. AccountingPeriod.mealConfigSnapshot
   * additionally freezes the whole config shape when Phase 6 moves a period
   * to PREPARING. If true multi-version config history is ever required,
   * this table would need an effectiveTo column and the @unique(messId)
   * constraint relaxed to @unique(messId, effectiveFrom) — flagging for
   * product sign-off before making that change.
   */
  async upsertConfig(messId: string, adminUserId: string, dto: UpsertMealConfigDto) {
    const result = await prisma.$transaction(async (tx) => {
      const config = await tx.messMealConfig.upsert({
        where: { messId },
        create: { messId },
        update: { effectiveFrom: new Date() },
      });

      // Full replace rather than diffing individual rows: MealRecord copies
      // weight/mealType directly and holds no FK to MealTypeConfig.id, so
      // deleting and recreating these rows is safe and much simpler for MVP.
      await tx.mealTypeConfig.deleteMany({ where: { mealConfigId: config.id } });
      await tx.mealTypeConfig.createMany({
        data: dto.mealTypes.map((mt) => ({
          mealConfigId: config.id,
          type: mt.type,
          label: mt.label,
          weight: mt.weight,
          isActive: mt.isActive,
          optOutDeadline: mt.optOutDeadline,
        })),
      });

      return tx.messMealConfig.findUniqueOrThrow({
        where: { id: config.id },
        include: { mealTypes: { orderBy: { type: 'asc' } } },
      });
    });

    await auditService.log({
      messId,
      actorUserId: adminUserId,
      action: AuditAction.MEAL_CONFIG_UPDATED,
      targetType: 'MessMealConfig',
      targetId: result.id,
      newState: { mealTypes: dto.mealTypes },
    });

    return result;
  }
}

export const mealConfigService = new MealConfigService();
