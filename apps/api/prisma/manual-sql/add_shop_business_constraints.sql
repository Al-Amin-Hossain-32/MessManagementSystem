-- ============================================================================
-- Phase 7 business-critical partial unique indexes.
-- Apply via: npx prisma migrate dev --create-only --name add_shop_business_constraints
-- then paste this file's contents into the generated migration.sql, then:
-- npx prisma migrate dev
-- ============================================================================

-- At most one Shop may be the platform default (mess.service.ts's
-- auto-link-on-Mess-creation logic does findFirst({ isDefault: true }) and
-- would silently pick an arbitrary one if more than one existed).
CREATE UNIQUE INDEX "one_default_shop"
  ON "shops" ("isDefault")
  WHERE "isDefault" = true;

-- At most one MessShopLink per Mess may be marked as the default link
-- (mirrors the Shop-level constraint above, for the same reason).
CREATE UNIQUE INDEX "one_default_shop_link_per_mess"
  ON "mess_shop_links" ("messId")
  WHERE "isDefault" = true;
