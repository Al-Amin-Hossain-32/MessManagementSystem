/**
 * Response shapes, derived from the backend Prisma schema + service `include`s.
 * Decimal columns arrive as strings in JSON. Relations are optional because
 * each endpoint includes a different subset.
 */
import type {
  MessStatus, MessMembershipRole, BoarderMembershipStatus, BoarderResidencyType,
  ManagerAssignmentStatus, MealType, MealRecordStatus, MealCorrectionRequestStatus,
  ExpenseDistributionMethod, ExpenseEligibleScope, ExpenseSourceType, ExpenseStatus,
  PaymentMethod, PaymentChannel, PaymentStatus, AccountingPeriodStatus,
  FundHandoverStatus, FundHandoverItemType, DisputeStatus, GuestMealChargingPolicy,
  GuestMealStatus, ShopOrderStatus, ShopStatus, StockStatus, VendorStatus,
  IntegrationProcessingStatus, SubscriptionPlan, SubscriptionStatus,
  NotificationType, OfflinePaymentMethod, BillingPaymentRequestStatus, DirectorRelationshipStatus, AuditAction,
} from '@messmess/types';

export type Decimal = string | number;
export type NotificationFilter = 'all' | 'unread' | 'read';
export interface UserRef { id: string; name: string; email?: string; phone?: string | null }
export interface ShopAdminCandidate { id: string; name: string; email: string }
export interface Notification {
  id: string; messId?: string | null; userId: string; channel: string; type: NotificationType;
  title: string; body: string; data?: unknown; isRead: boolean; readAt?: string | null; createdAt: string;
}
export interface NotificationPage {
  notifications: Notification[]; page: number; limit: number; total: number; hasMore: boolean;
}

export interface ChatMessage {
  id: string; messId: string; userId: string; clientMessageId?: string | null; content: string; createdAt: string; updatedAt: string; deletedAt?: string | null;
  sender: { id: string; name: string; email?: string; phone?: string | null };
  readReceipts?: { messageId: string; userId: string; seenAt: string; user: { id: string; name: string } }[];
}
export interface ChatMember { id: string; name: string; roles: string[] }

export interface UserContext {
  userId: string; name: string; email: string; platformRole: string; isPlatformAdmin: boolean;
  messMemberships: { messId: string; messName: string; messStatus: MessStatus; role: MessMembershipRole }[];
  boarderOf: { boarderMembershipId: string; messId: string; messName: string; messStatus: MessStatus }[];
  activeManagerAssignments: { managerAssignmentId: string; messId: string; messName: string; periodLabel: string }[];
  activeDirectorships: { relationshipId: string; messId: string; messName: string; messStatus: MessStatus }[];
  shopsManaged: { shopId: string; shopName: string }[];
}

export interface Invitations {
  coAdminInvites: { membershipId: string; messId: string; messName: string }[];
  boarderInvites: { membershipId: string; messId: string; messName: string }[];
  pendingJoinRequests: { membershipId: string; messId: string; messName: string }[];
  managerAssignments: { assignmentId: string; messId: string; messName: string; periodLabel: string; startDate: string; endDate: string }[];
  directorInvites: { relationshipId: string; messId: string; messName: string; invitedAt: string }[];
}

export interface BillingPaymentRequest {
  id: string; messId: string; plan: SubscriptionPlan; amount: Decimal; method: OfflinePaymentMethod;
  paymentReference: string; proofUrl?: string | null; notes?: string | null; status: BillingPaymentRequestStatus;
  reviewNote?: string | null; requestedAt: string; reviewedAt?: string | null;
  requester?: UserRef; reviewer?: UserRef; mess?: Pick<Mess, 'id' | 'name'>;
}
export interface MessSubscription {
  id: string; plan: SubscriptionPlan; status: SubscriptionStatus; currentPeriodStart: string; currentPeriodEnd: string;
  trialEndsAt?: string | null; cancelledAt?: string | null; billingAccount?: { billingEmail: string; status: string };
}
export interface AuditEntry {
  id: string; action: AuditAction; targetType?: string | null; targetId?: string | null;
  previousState?: unknown; newState?: unknown; notes?: string | null; createdAt: string;
  actor: UserRef;
}
export interface DirectorRelationship {
  id: string; status: DirectorRelationshipStatus; invitedAt: string; acceptedAt?: string | null;
  suspendedAt?: string | null; suspensionReason?: string | null; revokedAt?: string | null;
  director: UserRef;
}

export interface Mess {
  id: string; name: string; slug: string; address?: string | null; description?: string | null; status: MessStatus;
  subscription?: MessSubscription | null;
  _count?: { boarderMemberships: number };
}
export interface MessListItem { mess: Pick<Mess, 'id' | 'name' | 'slug' | 'status' | 'subscription'>; role: MessMembershipRole }

export interface Boarder {
  id: string; userId: string; messId: string; status: BoarderMembershipStatus; joinedAt?: string | null;
  requestedAt?: string | null; leftReason?: string | null; createdAt: string;
  user: UserRef; residencies?: { id: string; type: BoarderResidencyType; effectiveFrom: string }[];
}

export interface ManagerAssignment {
  id: string; userId: string; periodLabel: string; startDate: string; endDate: string;
  status: ManagerAssignmentStatus; terminationReason?: string | null; user?: UserRef;
}

export interface MealTypeConfig { type: MealType; label: string; weight: Decimal; isActive: boolean; optOutDeadline: string }
export interface MealConfig { id: string; mealTypes: MealTypeConfig[] }
export interface MealRecord {
  id: string; date: string; mealType: MealType; weight: Decimal; status: MealRecordStatus;
  boarderMembership?: { id: string; user: UserRef };
}
export interface CorrectionRequest {
  id: string; mealRecordId: string; requestedStatus?: MealRecordStatus | null; requestedWeight?: Decimal | null;
  reason: string; status: MealCorrectionRequestStatus; createdAt: string; reviewNotes?: string | null;
}

export interface GuestMealConfig { chargingPolicy: GuestMealChargingPolicy; requiresGuestInfo: boolean; rateMultiplier: Decimal }
export interface GuestMeal {
  id: string; date: string; mealType: MealType; quantity: number; guestName?: string | null;
  appliedRate: Decimal; totalCharge: Decimal; status: GuestMealStatus; hostBoarderMembershipId: string;
  hostBoarder?: { user?: UserRef };
}

export interface ExpenseCategory {
  id: string; name: string; countsTowardMealRate: boolean; distributionMethod: ExpenseDistributionMethod;
  eligibleMemberScope: ExpenseEligibleScope; selectedMemberIds: string[]; isActive: boolean;
}
export interface Expense {
  id: string; amount: Decimal; description: string; date: string; status: ExpenseStatus; sourceType: ExpenseSourceType;
  receiptRef?: string | null; rejectionReason?: string | null; category?: Pick<ExpenseCategory, 'id' | 'name' | 'distributionMethod'>;
  allocations?: { id: string; allocatedAmount: Decimal; boarderMembership?: { user?: { name: string } } }[];
}
export interface AllocationSummaryRow { boarderMembershipId: string; name: string; total: string }

export interface Payment {
  id: string; amount: Decimal; method: PaymentMethod; channel: PaymentChannel; status: PaymentStatus;
  initiatedBy: string;
  initiatedAt: string; transactionRef?: string | null; proofRef?: string | null; notes?: string | null;
  rejectionReason?: string | null; boarderMembershipId: string; boarderMembership?: { user?: UserRef };
}

export interface AccountingPeriod {
  id: string; periodLabel: string; startDate: string; endDate: string; status: AccountingPeriodStatus;
  finalMealRate?: Decimal | null; eligibleMealExpenseTotal?: Decimal | null; totalFinalizedWeightedMeals?: Decimal | null;
  hasUnresolvedDisputes?: boolean; hasAccountingException?: boolean; accountingExceptionReason?: string | null;
}
export interface Statement {
  id: string; accountingPeriodId: string; mealCost: Decimal; guestMealCharge: Decimal; totalExpenseAllocation: Decimal;
  directCharges: Decimal; openingBalance: Decimal; totalDue: Decimal; confirmedPayments: Decimal; closingBalance: Decimal;
  isAdjusted: boolean; boarderMembership?: { user?: UserRef }; accountingPeriod?: { periodLabel: string; status: AccountingPeriodStatus };
}
export interface Adjustment { id: string; targetType: string; targetId: string; reason: string; adjustedAmount?: Decimal | null; notes?: string | null; appliedAt: string }

export interface Dispute {
  id: string; targetType: string; targetId: string; description: string; status: DisputeStatus;
  resolution?: string | null; createdAt: string; raisedBy?: { user?: UserRef };
}

export interface HandoverItem { type: FundHandoverItemType; declaredAmount: Decimal; notes?: string }
export interface Handover {
  id: string; status: FundHandoverStatus; declaredItems: HandoverItem[]; totalDeclaredAmount: Decimal;
  acceptedAmount?: Decimal | null; adjustedAmount?: Decimal | null; disputeNotes?: string | null; createdAt: string;
  outgoingAssignment?: { id?: string; userId?: string; periodLabel?: string; user?: UserRef };
}

export interface Vendor { id: string; name: string; status: VendorStatus; isPlatformOwned: boolean }
export interface Shop { id: string; name: string; status: ShopStatus; isDefault: boolean; managedBy: string; vendorId: string }
export interface Product { id: string; name: string; category?: string | null; unit: string; basePrice: Decimal; stockStatus: StockStatus; isActive: boolean }
export interface OrderLine { id: string; productId: string; productNameSnapshot: string; unitPriceSnapshot: Decimal; quantity: Decimal; deliveredQuantity: Decimal; returnedQuantity: Decimal }
export interface ShopOrder {
  id: string; status: ShopOrderStatus; totalAmount: Decimal; deliveredAmount: Decimal; refundedAmount: Decimal;
  placedBy?: string; placedAt?: string | null; deliveredAt?: string | null; notes?: string | null; createdAt: string; messId?: string;
  lines?: OrderLine[]; orderLines?: OrderLine[]; mess?: { name: string };
}
export interface MessShopLink { id: string; shopId: string; defaultExpenseCategoryId?: string | null; shop?: Shop }
export interface IntegrationRecord { id: string; shopOrderId: string; eventType: string; processingStatus: IntegrationProcessingStatus; errorLog?: unknown; createdAt: string }
