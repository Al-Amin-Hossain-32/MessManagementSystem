import { prisma } from '../../lib/prisma';
import { auditService } from '../../lib/audit.service';
import { VendorStatus, AuditAction } from '@messmess/types';

class VendorService {
  /**
   * V1 always operates against a single, platform-owned Vendor. This is
   * auto-created on first use rather than a fixed seed row, so Vendor
   * remains a normal, queryable table from day one (not a hardcoded
   * constant) — exactly the SRS §23 "Vendor entity stubbed even if only one
   * vendor" requirement.
   */
  async getOrCreateDefaultVendor() {
    const existing = await prisma.vendor.findFirst({ where: { isPlatformOwned: true } });
    if (existing) return existing;

    return prisma.vendor.create({
      data: { name: 'MeshMess Platform', isPlatformOwned: true, status: VendorStatus.ACTIVE },
    });
  }

  /** Platform Admin onboards an additional (non-platform) Vendor — V2+ marketplace groundwork. */
  async createVendor(adminUserId: string, name: string) {
    const vendor = await prisma.vendor.create({
      data: { name, isPlatformOwned: false, status: VendorStatus.ACTIVE },
    });

    await auditService.log({
      actorUserId: adminUserId,
      action: AuditAction.VENDOR_CREATED,
      targetType: 'Vendor',
      targetId: vendor.id,
      newState: { name },
    });

    return vendor;
  }

  async listVendors() {
    return prisma.vendor.findMany({ orderBy: { onboardedAt: 'asc' } });
  }
}

export const vendorService = new VendorService();
