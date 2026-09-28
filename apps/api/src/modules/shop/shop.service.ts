import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { vendorService } from './vendor.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { AuditAction } from '@messmess/types';
import type { CreateShopDto, UpdateShopDto } from './shop.schema';

class ShopService {
  async createShop(adminUserId: string, dto: CreateShopDto) {
    const targetAdmin = await prisma.user.findUnique({
      where: { id: dto.managedByUserId },
      select: { id: true, isActive: true },
    });
    if (!targetAdmin || !targetAdmin.isActive) {
      throw new NotFoundError('Active user to manage this Shop');
    }

    const vendorId = dto.vendorId ?? (await vendorService.getOrCreateDefaultVendor()).id;

    try {
      const shop = await prisma.shop.create({
        data: {
          name: dto.name,
          vendorId,
          managedBy: dto.managedByUserId,
          isDefault: dto.isDefault,
        },
      });

      await auditService.log({
        actorUserId: adminUserId,
        action: AuditAction.SHOP_CREATED,
        targetType: 'Shop',
        targetId: shop.id,
        newState: { name: dto.name, isDefault: dto.isDefault },
      });

      return shop;
    } catch (err: unknown) {
      // Partial unique index: at most one Shop may have isDefault=true
      // (see migration: add_shop_business_constraints).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(
          'A default Shop already exists. Unset it before creating another default Shop.',
        );
      }
      throw err;
    }
  }

  async updateShop(adminUserId: string, shopId: string, dto: UpdateShopDto) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundError('Shop');

    const updated = await prisma.shop.update({ where: { id: shopId }, data: dto });

    await auditService.log({
      actorUserId: adminUserId,
      action: AuditAction.SHOP_UPDATED,
      targetType: 'Shop',
      targetId: shopId,
      previousState: { status: shop.status },
      newState: dto,
    });

    return updated;
  }

  /** Platform Admin reassigns which user manages this Shop. */
  async reassignShopAdmin(adminUserId: string, shopId: string, newManagedByUserId: string) {
    const [shop, targetAdmin] = await Promise.all([
      prisma.shop.findUnique({ where: { id: shopId } }),
      prisma.user.findUnique({ where: { id: newManagedByUserId }, select: { id: true, isActive: true } }),
    ]);
    if (!shop) throw new NotFoundError('Shop');
    if (!targetAdmin || !targetAdmin.isActive) throw new NotFoundError('Active target user');

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: { managedBy: newManagedByUserId },
    });

    await auditService.log({
      actorUserId: adminUserId,
      action: AuditAction.SHOP_ADMIN_ASSIGNED,
      targetType: 'Shop',
      targetId: shopId,
      previousState: { managedBy: shop.managedBy },
      newState: { managedBy: newManagedByUserId },
    });

    return updated;
  }

  async listShops() {
    return prisma.shop.findMany({ orderBy: { name: 'asc' } });
  }

  async getShop(shopId: string) {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundError('Shop');
    return shop;
  }
}

export const shopService = new ShopService();
