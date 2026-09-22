-- ============================================================================
-- Business-critical partial unique indexes.
-- Postgres does not let Prisma's @@unique express a WHERE clause, so these
-- must be added by hand into a --create-only migration. Prisma's default
-- column naming (camelCase, unquoted in schema.prisma) means these MUST be
-- double-quoted here to match exactly what Prisma generated for the base
-- tables (e.g. "userId", not user_id).
-- ============================================================================

-- SRS §11 — One-Active-Mess Rule: a user may hold only one ACTIVE
-- BoarderMembership at any time, platform-wide.
CREATE UNIQUE INDEX "one_active_mess_per_user"
  ON "boarder_memberships" ("userId")
  WHERE "status" = 'ACTIVE';

-- SRS §30 — exactly one ACTIVE PRIMARY_OWNER per Mess.
CREATE UNIQUE INDEX "one_primary_owner_per_mess"
  ON "mess_memberships" ("messId")
  WHERE "role" = 'PRIMARY_OWNER' AND "status" = 'ACTIVE';

-- SRS §12 — only one ACTIVE or PENDING_ACCEPTANCE ManagerAssignment per Mess
-- at any time (prevents two unresolved assignments existing simultaneously).
CREATE UNIQUE INDEX "one_inflight_manager_per_mess"
  ON "manager_assignments" ("messId")
  WHERE "status" IN ('ACTIVE', 'PENDING_ACCEPTANCE');

-- SRS §16/§28 — duplicate digital-payment protection. Added now (table
-- already exists in schema) even though the Payment module lands in Phase 5,
-- so it ships in the same "business constraints" migration as the others.
CREATE UNIQUE INDEX "unique_txref_per_mess"
  ON "payments" ("messId", "transactionRef")
  WHERE "transactionRef" IS NOT NULL;
