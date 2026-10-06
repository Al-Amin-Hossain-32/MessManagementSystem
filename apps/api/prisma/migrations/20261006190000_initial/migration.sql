-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "MessStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessMembershipRole" AS ENUM ('PRIMARY_OWNER', 'CO_ADMIN');

-- CreateEnum
CREATE TYPE "MessMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DirectorRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REVOKED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BoarderMembershipStatus" AS ENUM ('INVITED', 'PENDING_APPROVAL', 'ACTIVE', 'LEAVE_REQUESTED', 'ENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "BoarderJoinVia" AS ENUM ('ADMIN_INVITE', 'JOIN_REQUEST');

-- CreateEnum
CREATE TYPE "BoarderResidencyType" AS ENUM ('RESIDENT', 'MEAL_ONLY');

-- CreateEnum
CREATE TYPE "ManagerAssignmentStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACTIVE', 'COMPLETED', 'TERMINATED_EARLY');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MealRecordStatus" AS ENUM ('DEFAULT_ON', 'OPTED_OUT', 'LOCKED', 'FINALIZED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "ExpenseDistributionMethod" AS ENUM ('EQUAL_SPLIT', 'MEAL_PROPORTIONAL', 'DIRECT_CHARGE');

-- CreateEnum
CREATE TYPE "ExpenseEligibleScope" AS ENUM ('ALL', 'RESIDENT_ONLY', 'MEAL_ONLY', 'SELECTED_MEMBERS');

-- CreateEnum
CREATE TYPE "ExpenseSourceType" AS ENUM ('MANUAL_EXTERNAL', 'LINKED_SHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'DRAFT_FROM_SHOP', 'ACTIVE', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('CASH_CHANNEL', 'DIGITAL_CHANNEL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('ACTIVE', 'PREPARING', 'UNDER_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfflinePaymentMethod" AS ENUM ('BKASH', 'NAGAD', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingPaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FundHandoverStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DISPUTED', 'ACCEPTED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "GuestMealChargingPolicy" AS ENUM ('CHARGE_TO_HOST', 'SHARED_POOL', 'CUSTOM_CONFIGURED');

-- CreateEnum
CREATE TYPE "DisputeTargetType" AS ENUM ('MEAL_RECORD', 'PAYMENT', 'EXPENSE_ALLOCATION', 'STATEMENT');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('DRAFT', 'PLACED', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IntegrationEventType" AS ENUM ('ORDER_DELIVERED', 'PARTIALLY_DELIVERED', 'REFUND_ISSUED');

-- CreateEnum
CREATE TYPE "IntegrationProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GuestMealStatus" AS ENUM ('RECORDED', 'FINALIZED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_CHANGED', 'MESS_CREATED', 'MESS_UPDATED', 'MESS_STATUS_CHANGED', 'MESS_MEMBERSHIP_INVITED', 'MESS_MEMBERSHIP_ACCEPTED', 'MESS_MEMBERSHIP_REVOKED', 'DIRECTOR_INVITED', 'DIRECTOR_ACCEPTED', 'DIRECTOR_REVOKED', 'DIRECTOR_SUSPENDED', 'BILLING_PAYMENT_SUBMITTED', 'BILLING_PAYMENT_APPROVED', 'BILLING_PAYMENT_REJECTED', 'BOARDER_INVITED', 'BOARDER_INVITE_DECLINED', 'BOARDER_JOIN_REQUESTED', 'BOARDER_JOIN_REJECTED', 'BOARDER_APPROVED', 'BOARDER_REMOVED', 'BOARDER_LEAVE_REQUESTED', 'BOARDER_LEFT', 'BOARDER_RESIDENCY_CHANGED', 'MANAGER_ASSIGNED', 'MANAGER_ACCEPTED', 'MANAGER_COMPLETED', 'MANAGER_TERMINATED', 'MEAL_CONFIG_UPDATED', 'MEAL_OPTED_OUT', 'MEAL_OPT_IN_REVERTED', 'MEAL_LOCKED', 'MEAL_CORRECTION_REQUESTED', 'MEAL_CORRECTED', 'MEAL_CORRECTION_REJECTED', 'MEAL_FINALIZED', 'GUEST_MEAL_RECORDED', 'GUEST_MEAL_DISPUTED', 'EXPENSE_CATEGORY_CREATED', 'EXPENSE_CATEGORY_UPDATED', 'EXPENSE_CREATED', 'EXPENSE_CONFIRMED', 'EXPENSE_REJECTED', 'EXPENSE_REVERSED', 'EXPENSE_ALLOCATED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'PAYMENT_DISPUTED', 'PAYMENT_REJECTED', 'PAYMENT_REVERSED', 'PERIOD_CREATED', 'PERIOD_PREPARING', 'PERIOD_UNDER_REVIEW', 'PERIOD_CLOSED', 'PERIOD_ADJUSTMENT', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'DISPUTE_DISMISSED', 'HANDOVER_SUBMITTED', 'HANDOVER_ACCEPTED', 'HANDOVER_DISPUTED', 'HANDOVER_ADJUSTED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPGRADED', 'SUBSCRIPTION_DOWNGRADED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_SUSPENDED', 'PLATFORM_ADMIN_ACTION', 'PLATFORM_ADMIN_GRANTED', 'PLATFORM_ADMIN_REVOKED', 'VENDOR_CREATED', 'SHOP_CREATED', 'SHOP_UPDATED', 'SHOP_ADMIN_ASSIGNED', 'MESS_SHOP_LINK_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'SHOP_ORDER_CREATED', 'SHOP_ORDER_PLACED', 'SHOP_ORDER_STATUS_CHANGED', 'SHOP_ORDER_CANCELLED', 'SHOP_ORDER_DELIVERED', 'SHOP_ORDER_REFUNDED', 'INTEGRATION_PROCESSED', 'INTEGRATION_FAILED', 'INTEGRATION_RETRIED');

-- CreateEnum
CREATE TYPE "MealCorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "status" "MessStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "role" "MessMembershipRole" NOT NULL,
    "status" "MessMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "director_relationships" (
    "id" TEXT NOT NULL,
    "directorUserId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "status" "DirectorRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspensionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "director_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarder_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "status" "BoarderMembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joinedVia" "BoarderJoinVia",
    "invitedBy" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "leftReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boarder_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarder_residencies" (
    "id" TEXT NOT NULL,
    "boarderMembershipId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "type" "BoarderResidencyType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boarder_residencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_assignments" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ManagerAssignmentStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,

    CONSTRAINT "manager_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_meal_configs" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_meal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_type_configs" (
    "id" TEXT NOT NULL,
    "mealConfigId" TEXT NOT NULL,
    "type" "MealType" NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DECIMAL(4,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "optOutDeadline" TEXT NOT NULL,

    CONSTRAINT "meal_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_guest_meal_configs" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "chargingPolicy" "GuestMealChargingPolicy" NOT NULL DEFAULT 'CHARGE_TO_HOST',
    "requiresGuestInfo" BOOLEAN NOT NULL DEFAULT false,
    "rateMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mess_guest_meal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "mealConfigSnapshot" JSONB,
    "expenseCategorySnapshot" JSONB,
    "eligibleMealExpenseTotal" DECIMAL(12,2),
    "totalFinalizedWeightedMeals" DECIMAL(10,2),
    "finalMealRate" DECIMAL(10,4),
    "preparingAt" TIMESTAMP(3),
    "underReviewAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "hasUnresolvedDisputes" BOOLEAN NOT NULL DEFAULT false,
    "hasAccountingException" BOOLEAN NOT NULL DEFAULT false,
    "accountingExceptionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_records" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "boarderMembershipId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "weight" DECIMAL(4,2) NOT NULL,
    "status" "MealRecordStatus" NOT NULL DEFAULT 'DEFAULT_ON',
    "correctionRef" TEXT,
    "correctionReason" TEXT,
    "correctedBy" TEXT,
    "correctedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_correction_requests" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "mealRecordId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedStatus" "MealRecordStatus" NOT NULL,
    "requestedWeight" DECIMAL(4,2),
    "reason" TEXT NOT NULL,
    "status" "MealCorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countsTowardMealRate" BOOLEAN NOT NULL DEFAULT false,
    "distributionMethod" "ExpenseDistributionMethod" NOT NULL,
    "eligibleMemberScope" "ExpenseEligibleScope" NOT NULL DEFAULT 'ALL',
    "selectedMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sourceType" "ExpenseSourceType" NOT NULL DEFAULT 'MANUAL_EXTERNAL',
    "sourceShopOrderId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "receiptRef" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "recordedBy" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "reversalRef" TEXT,
    "directChargeBoarderMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_allocations" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "boarderMembershipId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "calculationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_meals" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "hostBoarderMembershipId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "guestName" TEXT,
    "guestInfo" JSONB,
    "appliedRate" DECIMAL(10,4) NOT NULL,
    "totalCharge" DECIMAL(12,2) NOT NULL,
    "chargedToHost" BOOLEAN NOT NULL DEFAULT true,
    "status" "GuestMealStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "boarderMembershipId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionRef" TEXT,
    "proofRef" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disputedBy" TEXT,
    "disputedAt" TIMESTAMP(3),
    "reversalRef" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarder_monthly_statements" (
    "id" TEXT NOT NULL,
    "boarderMembershipId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "mealCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "guestMealCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalExpenseAllocation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "directCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confirmedPayments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculationSnapshot" JSONB NOT NULL,
    "isAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boarder_monthly_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_adjustments" (
    "id" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedAmount" DECIMAL(12,2),
    "approvedBy" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "period_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_handovers" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "outgoingAssignmentId" TEXT NOT NULL,
    "incomingAssignmentId" TEXT,
    "declaredItems" JSONB NOT NULL,
    "totalDeclaredAmount" DECIMAL(12,2) NOT NULL,
    "acceptedAmount" DECIMAL(12,2),
    "status" "FundHandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "disputeNotes" TEXT,
    "adjustedAmount" DECIMAL(12,2),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_records" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "accountingPeriodId" TEXT,
    "raisedByBoarderId" TEXT NOT NULL,
    "targetType" "DisputeTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payment_requests" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "OfflinePaymentMethod" NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "proofUrl" TEXT,
    "notes" TEXT,
    "status" "BillingPaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPlatformOwned" BOOLEAN NOT NULL DEFAULT true,
    "onboardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShopStatus" NOT NULL DEFAULT 'ACTIVE',
    "managedBy" TEXT NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mess_shop_links" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "defaultExpenseCategoryId" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mess_shop_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_orders" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "placedBy" TEXT NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "deliveredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "deliveredQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "returnedQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,

    CONSTRAINT "shop_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_records" (
    "id" TEXT NOT NULL,
    "shopOrderId" TEXT NOT NULL,
    "fulfillmentEventId" TEXT NOT NULL,
    "eventType" "IntegrationEventType" NOT NULL,
    "messId" TEXT NOT NULL,
    "messExpenseId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "processingStatus" "IntegrationProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_reads" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "idempotencyKey" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "messes_slug_key" ON "messes"("slug");

-- CreateIndex
CREATE INDEX "mess_memberships_messId_status_idx" ON "mess_memberships"("messId", "status");

-- CreateIndex
CREATE INDEX "mess_memberships_userId_status_idx" ON "mess_memberships"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mess_memberships_userId_messId_key" ON "mess_memberships"("userId", "messId");

-- CreateIndex
CREATE INDEX "director_relationships_directorUserId_status_idx" ON "director_relationships"("directorUserId", "status");

-- CreateIndex
CREATE INDEX "director_relationships_messId_status_idx" ON "director_relationships"("messId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "director_relationships_directorUserId_messId_key" ON "director_relationships"("directorUserId", "messId");

-- CreateIndex
CREATE INDEX "boarder_memberships_userId_status_idx" ON "boarder_memberships"("userId", "status");

-- CreateIndex
CREATE INDEX "boarder_memberships_messId_status_idx" ON "boarder_memberships"("messId", "status");

-- CreateIndex
CREATE INDEX "boarder_residencies_boarderMembershipId_idx" ON "boarder_residencies"("boarderMembershipId");

-- CreateIndex
CREATE INDEX "boarder_residencies_messId_effectiveFrom_idx" ON "boarder_residencies"("messId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "manager_assignments_messId_status_idx" ON "manager_assignments"("messId", "status");

-- CreateIndex
CREATE INDEX "manager_assignments_userId_status_idx" ON "manager_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "manager_assignments_messId_startDate_endDate_idx" ON "manager_assignments"("messId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "mess_meal_configs_messId_key" ON "mess_meal_configs"("messId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_type_configs_mealConfigId_type_key" ON "meal_type_configs"("mealConfigId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "mess_guest_meal_configs_messId_key" ON "mess_guest_meal_configs"("messId");

-- CreateIndex
CREATE INDEX "accounting_periods_messId_status_idx" ON "accounting_periods"("messId", "status");

-- CreateIndex
CREATE INDEX "accounting_periods_messId_startDate_idx" ON "accounting_periods"("messId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_messId_periodLabel_key" ON "accounting_periods"("messId", "periodLabel");

-- CreateIndex
CREATE INDEX "meal_records_messId_date_idx" ON "meal_records"("messId", "date");

-- CreateIndex
CREATE INDEX "meal_records_messId_accountingPeriodId_status_idx" ON "meal_records"("messId", "accountingPeriodId", "status");

-- CreateIndex
CREATE INDEX "meal_records_boarderMembershipId_accountingPeriodId_idx" ON "meal_records"("boarderMembershipId", "accountingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_records_boarderMembershipId_date_mealType_key" ON "meal_records"("boarderMembershipId", "date", "mealType");

-- CreateIndex
CREATE INDEX "meal_correction_requests_messId_status_idx" ON "meal_correction_requests"("messId", "status");

-- CreateIndex
CREATE INDEX "meal_correction_requests_mealRecordId_idx" ON "meal_correction_requests"("mealRecordId");

-- CreateIndex
CREATE INDEX "expense_categories_messId_isActive_idx" ON "expense_categories"("messId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_messId_name_key" ON "expense_categories"("messId", "name");

-- CreateIndex
CREATE INDEX "expenses_messId_accountingPeriodId_idx" ON "expenses"("messId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "expenses_messId_status_idx" ON "expenses"("messId", "status");

-- CreateIndex
CREATE INDEX "expenses_sourceShopOrderId_idx" ON "expenses"("sourceShopOrderId");

-- CreateIndex
CREATE INDEX "expense_allocations_boarderMembershipId_idx" ON "expense_allocations"("boarderMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_allocations_expenseId_boarderMembershipId_key" ON "expense_allocations"("expenseId", "boarderMembershipId");

-- CreateIndex
CREATE INDEX "guest_meals_messId_accountingPeriodId_idx" ON "guest_meals"("messId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "guest_meals_hostBoarderMembershipId_idx" ON "guest_meals"("hostBoarderMembershipId");

-- CreateIndex
CREATE INDEX "payments_messId_accountingPeriodId_status_idx" ON "payments"("messId", "accountingPeriodId", "status");

-- CreateIndex
CREATE INDEX "payments_boarderMembershipId_status_idx" ON "payments"("boarderMembershipId", "status");

-- CreateIndex
CREATE INDEX "boarder_monthly_statements_accountingPeriodId_idx" ON "boarder_monthly_statements"("accountingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "boarder_monthly_statements_boarderMembershipId_accountingPe_key" ON "boarder_monthly_statements"("boarderMembershipId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "period_adjustments_accountingPeriodId_idx" ON "period_adjustments"("accountingPeriodId");

-- CreateIndex
CREATE INDEX "fund_handovers_messId_idx" ON "fund_handovers"("messId");

-- CreateIndex
CREATE INDEX "fund_handovers_outgoingAssignmentId_idx" ON "fund_handovers"("outgoingAssignmentId");

-- CreateIndex
CREATE INDEX "dispute_records_messId_status_idx" ON "dispute_records"("messId", "status");

-- CreateIndex
CREATE INDEX "dispute_records_accountingPeriodId_idx" ON "dispute_records"("accountingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_ownerUserId_key" ON "billing_accounts"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_messId_key" ON "subscriptions"("messId");

-- CreateIndex
CREATE INDEX "subscriptions_billingAccountId_idx" ON "subscriptions"("billingAccountId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "billing_payment_requests_messId_status_requestedAt_idx" ON "billing_payment_requests"("messId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "billing_payment_requests_status_requestedAt_idx" ON "billing_payment_requests"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payment_requests_messId_paymentReference_key" ON "billing_payment_requests"("messId", "paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "mess_shop_links_messId_shopId_key" ON "mess_shop_links"("messId", "shopId");

-- CreateIndex
CREATE INDEX "products_shopId_isActive_idx" ON "products"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "shop_orders_messId_status_idx" ON "shop_orders"("messId", "status");

-- CreateIndex
CREATE INDEX "shop_orders_shopId_status_idx" ON "shop_orders"("shopId", "status");

-- CreateIndex
CREATE INDEX "shop_order_lines_orderId_idx" ON "shop_order_lines"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_records_messExpenseId_key" ON "integration_records"("messExpenseId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_records_idempotencyKey_key" ON "integration_records"("idempotencyKey");

-- CreateIndex
CREATE INDEX "integration_records_shopOrderId_idx" ON "integration_records"("shopOrderId");

-- CreateIndex
CREATE INDEX "integration_records_messId_idx" ON "integration_records"("messId");

-- CreateIndex
CREATE INDEX "chat_messages_messId_createdAt_idx" ON "chat_messages"("messId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_messId_userId_idx" ON "chat_messages"("messId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_userId_clientMessageId_key" ON "chat_messages"("userId", "clientMessageId");

-- CreateIndex
CREATE INDEX "chat_message_reads_userId_seenAt_idx" ON "chat_message_reads"("userId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_reads_messageId_userId_key" ON "chat_message_reads"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotencyKey_key" ON "notifications"("idempotencyKey");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_messId_idx" ON "notifications"("messId");

-- CreateIndex
CREATE INDEX "audit_logs_messId_createdAt_idx" ON "audit_logs"("messId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_memberships" ADD CONSTRAINT "mess_memberships_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_relationships" ADD CONSTRAINT "director_relationships_directorUserId_fkey" FOREIGN KEY ("directorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_relationships" ADD CONSTRAINT "director_relationships_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarder_memberships" ADD CONSTRAINT "boarder_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarder_memberships" ADD CONSTRAINT "boarder_memberships_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarder_residencies" ADD CONSTRAINT "boarder_residencies_boarderMembershipId_fkey" FOREIGN KEY ("boarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_meal_configs" ADD CONSTRAINT "mess_meal_configs_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_type_configs" ADD CONSTRAINT "meal_type_configs_mealConfigId_fkey" FOREIGN KEY ("mealConfigId") REFERENCES "mess_meal_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_guest_meal_configs" ADD CONSTRAINT "mess_guest_meal_configs_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_boarderMembershipId_fkey" FOREIGN KEY ("boarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_records" ADD CONSTRAINT "meal_records_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_correction_requests" ADD CONSTRAINT "meal_correction_requests_mealRecordId_fkey" FOREIGN KEY ("mealRecordId") REFERENCES "meal_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_directChargeBoarderMembershipId_fkey" FOREIGN KEY ("directChargeBoarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_boarderMembershipId_fkey" FOREIGN KEY ("boarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_meals" ADD CONSTRAINT "guest_meals_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_meals" ADD CONSTRAINT "guest_meals_hostBoarderMembershipId_fkey" FOREIGN KEY ("hostBoarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_meals" ADD CONSTRAINT "guest_meals_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_boarderMembershipId_fkey" FOREIGN KEY ("boarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarder_monthly_statements" ADD CONSTRAINT "boarder_monthly_statements_boarderMembershipId_fkey" FOREIGN KEY ("boarderMembershipId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarder_monthly_statements" ADD CONSTRAINT "boarder_monthly_statements_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_adjustments" ADD CONSTRAINT "period_adjustments_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_handovers" ADD CONSTRAINT "fund_handovers_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_handovers" ADD CONSTRAINT "fund_handovers_outgoingAssignmentId_fkey" FOREIGN KEY ("outgoingAssignmentId") REFERENCES "manager_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_handovers" ADD CONSTRAINT "fund_handovers_incomingAssignmentId_fkey" FOREIGN KEY ("incomingAssignmentId") REFERENCES "manager_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_records" ADD CONSTRAINT "dispute_records_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_records" ADD CONSTRAINT "dispute_records_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_records" ADD CONSTRAINT "dispute_records_raisedByBoarderId_fkey" FOREIGN KEY ("raisedByBoarderId") REFERENCES "boarder_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "billing_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_requests" ADD CONSTRAINT "billing_payment_requests_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_requests" ADD CONSTRAINT "billing_payment_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_requests" ADD CONSTRAINT "billing_payment_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_shop_links" ADD CONSTRAINT "mess_shop_links_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_shop_links" ADD CONSTRAINT "mess_shop_links_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mess_shop_links" ADD CONSTRAINT "mess_shop_links_defaultExpenseCategoryId_fkey" FOREIGN KEY ("defaultExpenseCategoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_lines" ADD CONSTRAINT "shop_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_lines" ADD CONSTRAINT "shop_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_records" ADD CONSTRAINT "integration_records_shopOrderId_fkey" FOREIGN KEY ("shopOrderId") REFERENCES "shop_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_records" ADD CONSTRAINT "integration_records_messExpenseId_fkey" FOREIGN KEY ("messExpenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_messId_fkey" FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
