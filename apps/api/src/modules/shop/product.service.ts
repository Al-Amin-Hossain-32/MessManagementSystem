import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { NotFoundError } from '../../lib/errors';
import { AuditAction } from '@messmess/types';
import type { CreateProductDto, UpdateProductDto } from './product.schema';

class ProductService {
  async createProduct(shopId: string, adminUserId: string, dto: CreateProductDto) {
    const product = await prisma.product.create({
      data: {
        shopId,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        basePrice: dto.basePrice,
        stockStatus: dto.stockStatus,
      },
    });

    await auditService.log({
      actorUserId: adminUserId,
      action: AuditAction.PRODUCT_CREATED,
      targetType: 'Product',
      targetId: product.id,
      newState: { name: dto.name, basePrice: dto.basePrice },
    });

    return product;
  }

  async updateProduct(shopId: string, adminUserId: string, productId: string, dto: UpdateProductDto) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.shopId !== shopId) throw new NotFoundError('Product');

    const updated = await prisma.product.update({ where: { id: productId }, data: dto });

    await auditService.log({
      actorUserId: adminUserId,
      action: AuditAction.PRODUCT_UPDATED,
      targetType: 'Product',
      targetId: productId,
      previousState: { basePrice: product.basePrice.toString(), stockStatus: product.stockStatus },
      newState: dto,
    });

    return updated;
  }

  /** Open to any authenticated user — Managers need to browse the catalog to place orders. */
  async listProducts(shopId: string, activeOnly = true) {
    return prisma.product.findMany({
      where: { shopId, ...(activeOnly && { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async getProduct(shopId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.shopId !== shopId) throw new NotFoundError('Product');
    return product;
  }
}

export const productService = new ProductService();
