/**
 * Typed endpoint layer — one function per real backend route (see apps/api/src/modules/*).
 * Nothing here is invented: every path/method/body mirrors a route + zod schema in the API.
 * Adding a backend module later = add a block here + a feature folder; nothing else changes.
 */
import { ApiError, api, request, setAccessToken } from './api-client';
import type * as T from './types';

const m = (id: string) => `/messes/${id}`;
type Q = Record<string, unknown>;

export const auth = {
  register: (b: { name: string; email: string; phone?: string; password: string }) => api.post<{ user: T.UserRef }>('/auth/register', b),
  login: async (b: { email: string; password: string }) => {
    const r = await api.post<{ user: T.UserRef; tokens: { accessToken: string } }>('/auth/login', b);
    setAccessToken(r.tokens.accessToken);
    return r;
  },
  logout: () => request<void>('POST', '/auth/logout'),
  context: () => api.get<T.UserContext>('/users/me/context'),
  invitations: () => api.get<T.Invitations>('/users/me/invitations'),
};

export const userDirectory = {
  searchForShopAdmin: (q: string) =>
    api.get<{ users: T.ShopAdminCandidate[] }>('/users/search', { q }),
};

export const notifications = {
  list: (filter: T.NotificationFilter = 'all', page = 1, limit = 20) =>
    api.get<T.NotificationPage>('/notifications', { filter, page, limit }),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (notificationId: string) =>
    api.patch<{ notification: T.Notification; changed: boolean }>(`/notifications/${notificationId}/read`),
  markAllRead: () => api.patch<{ updatedCount: number }>('/notifications/read-all'),
};

export const chat = {
  list: (messId: string, page = 1, limit = 20) => api.get<{ messages: T.ChatMessage[]; page: number; limit: number; total: number; hasMore: boolean }>(`${m(messId)}/chat`, { page, limit }),
  members: (messId: string) => api.get<{ members: T.ChatMember[] }>(`${m(messId)}/chat/members`),
  unreadCount: (messId: string) => api.get<{ count: number }>(`${m(messId)}/chat/unread-count`),
  send: (messId: string, content: string) => api.post<{ message: T.ChatMessage }>(`${m(messId)}/chat`, { content }),
  delete: (messId: string, messageId: string) => api.delete<{ message: T.ChatMessage; deleted: boolean }>(`${m(messId)}/chat/${messageId}`),
};

export const billing = {
  get: (messId: string) => api.get<{ subscription: T.MessSubscription }>(`${m(messId)}/billing`),
  list: (messId: string, q?: Q) => api.get<{ requests: T.BillingPaymentRequest[]; total: number; page: number; limit: number; hasMore: boolean }>(`${m(messId)}/billing/requests`, q),
  createRequest: (messId: string, body: { plan: string; amount: number; method: string; paymentReference: string; proofUrl?: string; notes?: string }) =>
    api.post<{ request: T.BillingPaymentRequest }>(`${m(messId)}/billing/requests`, body),
  platformList: (q?: Q) => api.get<{ requests: T.BillingPaymentRequest[]; total: number; page: number; limit: number; hasMore: boolean }>('/platform/billing/requests', q),
  approve: (id: string) => api.patch<{ subscription: unknown; request: T.BillingPaymentRequest }>(`/platform/billing/requests/${id}/approve`),
  reject: (id: string, reason: string) => api.patch<{ request: T.BillingPaymentRequest }>(`/platform/billing/requests/${id}/reject`, { reason }),
};

export const audit = {
  list: (messId: string, q?: Q) => api.get<{ logs: T.AuditEntry[]; total: number; page: number; limit: number; hasMore: boolean }>(`${m(messId)}/audit`, q),
};

export const directors = {
  list: (messId: string) => api.get<{ directors: T.DirectorRelationship[] }>(`${m(messId)}/directors`),
  invite: (messId: string, email: string) => api.post<{ director: T.DirectorRelationship }>(`${m(messId)}/directors`, { email }),
  respond: (messId: string, relationshipId: string, accept: boolean) =>
    api.post<{ director: T.DirectorRelationship }>(`${m(messId)}/directors/${relationshipId}/${accept ? 'accept' : 'decline'}`),
  suspend: (messId: string, relationshipId: string, reason: string) =>
    api.patch<{ director: T.DirectorRelationship }>(`${m(messId)}/directors/${relationshipId}/suspend`, { reason }),
  reactivate: (messId: string, relationshipId: string) =>
    api.patch<{ director: T.DirectorRelationship }>(`${m(messId)}/directors/${relationshipId}/reactivate`),
  revoke: (messId: string, relationshipId: string) =>
    api.delete<{ director: T.DirectorRelationship }>(`${m(messId)}/directors/${relationshipId}`),
};

export const messes = {
  list: () => api.get<{ messes: T.MessListItem[] }>('/messes'),
  create: (b: { name: string; address?: string; description?: string }) => api.post<{ mess: T.Mess }>('/messes', b),
  get: (id: string) => api.get<{ mess: T.Mess }>(m(id)),
  update: (id: string, b: Partial<{ name: string; address: string; description: string }>) => api.patch<{ mess: T.Mess }>(m(id), b),
  bySlug: (slug: string) => api.get<{ mess: Pick<T.Mess, 'id' | 'name' | 'slug' | 'address' | 'status'> }>(`/messes/by-slug/${encodeURIComponent(slug)}`),
  inviteCoAdmin: (id: string, email: string) => api.post(`${m(id)}/co-admins`, { email }),
  acceptCoAdmin: (id: string) => api.post(`${m(id)}/co-admins/accept`),
};

export const members = {
  list: (id: string, status?: string) => api.get<{ boarders: T.Boarder[] }>(`${m(id)}/members`, { status }),
  invite: (id: string, email: string) => api.post(`${m(id)}/members/invite`, { email }),
  acceptInvite: (id: string) => api.post(`${m(id)}/members/accept-invite`),
  declineInvite: (id: string) => api.post(`${m(id)}/members/decline-invite`),
  requestJoin: (id: string) => api.post(`${m(id)}/members/join-requests`),
  approve: (id: string, mid: string) => api.patch(`${m(id)}/members/join-requests/${mid}/approve`),
  reject: (id: string, mid: string, reason?: string) => api.patch(`${m(id)}/members/join-requests/${mid}/reject`, { reason }),
  leave: (id: string, reason?: string) => api.patch(`${m(id)}/members/leave`, { reason }),
  end: (id: string, mid: string, reason?: string) => api.patch(`${m(id)}/members/${mid}/end`, { reason }),
  residency: (id: string, mid: string, b: { type: string; effectiveFrom?: string; reason?: string }) => api.post(`${m(id)}/members/${mid}/residency`, b),
};

export const managers = {
  list: (id: string) => api.get<{ assignments: T.ManagerAssignment[] }>(`${m(id)}/managers`),
  current: (id: string) => api.get<{ assignment: T.ManagerAssignment | null }>(`${m(id)}/managers/current`),
  assign: (id: string, b: { userId: string; periodLabel: string; startDate: string; endDate: string }) => api.post(`${m(id)}/managers`, b),
  accept: (id: string, aid: string) => api.patch(`${m(id)}/managers/${aid}/accept`),
  complete: (id: string, aid: string) => api.patch(`${m(id)}/managers/${aid}/complete`),
  terminate: (id: string, aid: string, reason: string) => api.patch(`${m(id)}/managers/${aid}/terminate`, { reason }),
};

export const mealConfig = {
  get: (id: string) => api.get<{ config: T.MealConfig | null }>(`${m(id)}/meal-config`),
  put: (id: string, mealTypes: T.MealTypeConfig[]) => api.put(`${m(id)}/meal-config`, { mealTypes }),
};

export const meals = {
  day: (id: string, date: string) => api.get<{ date: string; meals: T.MealRecord[] }>(`${m(id)}/meals`, { date }),
  mine: (id: string, date: string) => api.get<{ date: string; meals: T.MealRecord[] }>(`${m(id)}/meals/mine`, { date }),
  history: (id: string) => api.get<{ meals: T.MealRecord[] }>(`${m(id)}/meals/mine/history`),
  optOut: (id: string, b: { date: string; mealType: string }) => api.patch(`${m(id)}/meals/opt-out`, b),
  optIn: (id: string, b: { date: string; mealType: string }) => api.patch(`${m(id)}/meals/opt-in`, b),
  generate: (id: string, date?: string) => api.post(`${m(id)}/meals/generate`, { date }),
  lockExpired: (id: string) => api.post(`${m(id)}/meals/lock-expired`),
  corrections: (id: string, status?: string) => api.get<{ requests: T.CorrectionRequest[] }>(`${m(id)}/meals/corrections`, { status }),
  requestCorrection: (id: string, rid: string, b: { requestedStatus?: string; requestedWeight?: number; reason: string }) => api.post(`${m(id)}/meals/${rid}/corrections`, b),
  approve: (id: string, qid: string, reviewNotes?: string) => api.patch(`${m(id)}/meals/corrections/${qid}/approve`, { reviewNotes }),
  reject: (id: string, qid: string, reviewNotes?: string) => api.patch(`${m(id)}/meals/corrections/${qid}/reject`, { reviewNotes }),
};

export const guestMeals = {
  config: (id: string) => api.get<{ config: T.GuestMealConfig | null }>(`${m(id)}/guest-meals/config`),
  putConfig: (id: string, b: T.GuestMealConfig) => api.put(`${m(id)}/guest-meals/config`, b),
  list: (id: string, accountingPeriodId?: string) => api.get<{ guestMeals: T.GuestMeal[] }>(`${m(id)}/guest-meals`, { accountingPeriodId }),
  record: (id: string, b: Q) => api.post(`${m(id)}/guest-meals`, b),
  dispute: (id: string, gid: string, reason: string) => api.patch(`${m(id)}/guest-meals/${gid}/dispute`, { reason }),
};

export const categories = {
  list: (id: string) => api.get<{ categories: T.ExpenseCategory[] }>(`${m(id)}/expense-categories`),
  create: (id: string, b: Q) => api.post(`${m(id)}/expense-categories`, b),
  update: (id: string, cid: string, b: Q) => api.patch(`${m(id)}/expense-categories/${cid}`, b),
};

export const expenses = {
  list: (id: string, q?: Q) => api.get<{ expenses: T.Expense[] }>(`${m(id)}/expenses`, q),
  get: (id: string, eid: string) => api.get<{ expense: T.Expense }>(`${m(id)}/expenses/${eid}`),
  create: (id: string, b: Q) => api.post(`${m(id)}/expenses`, b),
  confirm: (id: string, eid: string) => api.patch(`${m(id)}/expenses/${eid}/confirm`),
  reject: (id: string, eid: string, reason: string) => api.patch(`${m(id)}/expenses/${eid}/reject`, { reason }),
  reverse: (id: string, eid: string, reason: string) => api.patch(`${m(id)}/expenses/${eid}/reverse`, { reason }),
  recalc: (id: string, pid: string) => api.post(`${m(id)}/expenses/allocations/${pid}/recalculate`),
  summary: (id: string, pid: string) => api.get<{ summary: T.AllocationSummaryRow[] }>(`${m(id)}/expenses/allocations/${pid}/summary`),
};

export const payments = {
  list: (id: string, q?: Q) => api.get<{ payments: T.Payment[] }>(`${m(id)}/payments`, q),
  fundSummary: (id: string) => api.get<{ collected: T.Decimal; spent: T.Decimal; balance: T.Decimal }>(`${m(id)}/payments/fund-summary`),
  mine: (id: string) => api.get<{ payments: T.Payment[] }>(`${m(id)}/payments/mine`),
  cash: (id: string, b: Q) => api.post(`${m(id)}/payments/cash`, b),
  digital: (id: string, b: Q) => api.post(`${m(id)}/payments/digital`, b),
  confirmCash: (id: string, pid: string) => api.patch(`${m(id)}/payments/${pid}/confirm-cash`),
  disputeCash: (id: string, pid: string, reason: string) => api.patch(`${m(id)}/payments/${pid}/dispute-cash`, { reason }),
  verifyDigital: (id: string, pid: string, b: { decision: string; reason?: string }) => api.patch(`${m(id)}/payments/${pid}/verify-digital`, b),
  resolve: (id: string, pid: string, b: { decision: string; reason?: string }) => api.patch(`${m(id)}/payments/${pid}/resolve`, b),
  reverse: (id: string, pid: string, reason: string) => api.patch(`${m(id)}/payments/${pid}/reverse`, { reason }),
};

const getMyStatement = (id: string, pid: string) =>
  api.get<{ statement: T.Statement }>(`${m(id)}/accounting/periods/${pid}/statements/mine`);

export const accounting = {
  current: (id: string) => api.get<{ period: T.AccountingPeriod | null }>(`${m(id)}/accounting/current-period`),
  periods: (id: string) => api.get<{ periods: T.AccountingPeriod[] }>(`${m(id)}/accounting/periods`),
  initiateClose: (id: string, pid: string) => api.post(`${m(id)}/accounting/periods/${pid}/initiate-close`),
  close: (id: string, pid: string, forceOverride: boolean) => api.post(`${m(id)}/accounting/periods/${pid}/close`, { forceOverride }),
  adjustments: (id: string, pid: string) => api.get<{ adjustments: T.Adjustment[] }>(`${m(id)}/accounting/periods/${pid}/adjustments`),
  adjust: (id: string, pid: string, b: Q) => api.post(`${m(id)}/accounting/periods/${pid}/adjustments`, b),
  statements: (id: string, pid: string) => api.get<{ statements: T.Statement[] }>(`${m(id)}/accounting/periods/${pid}/statements`),
  myStatement: getMyStatement,
  myStatementIfGenerated: async (id: string, pid: string) => {
    try {
      return await getMyStatement(id, pid);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.code === 'NOT_FOUND' && error.message === 'Statement not found') {
        return null;
      }
      throw error;
    }
  },
  history: (id: string) => api.get<{ statements: T.Statement[] }>(`${m(id)}/accounting/statements/history`),
};

export const disputes = {
  list: (id: string, q?: Q) => api.get<{ disputes: T.Dispute[] }>(`${m(id)}/disputes`, q),
  mine: (id: string) => api.get<{ disputes: T.Dispute[] }>(`${m(id)}/disputes/mine`),
  raise: (id: string, b: Q) => api.post(`${m(id)}/disputes`, b),
  review: (id: string, did: string) => api.patch(`${m(id)}/disputes/${did}/review`),
  resolve: (id: string, did: string, resolution: string) => api.patch(`${m(id)}/disputes/${did}/resolve`, { resolution }),
  dismiss: (id: string, did: string, reason: string) => api.patch(`${m(id)}/disputes/${did}/dismiss`, { reason }),
};

export const handovers = {
  list: (id: string) => api.get<{ handovers: T.Handover[] }>(`${m(id)}/handovers`),
  create: (id: string, b: { incomingAssignmentId?: string; declaredItems: T.HandoverItem[] }) => api.post(`${m(id)}/handovers`, b),
  submit: (id: string, hid: string, incomingAssignmentId: string) => api.patch(`${m(id)}/handovers/${hid}/submit`, { incomingAssignmentId }),
  accept: (id: string, hid: string) => api.patch(`${m(id)}/handovers/${hid}/accept`),
  dispute: (id: string, hid: string, disputeNotes: string) => api.patch(`${m(id)}/handovers/${hid}/dispute`, { disputeNotes }),
  resolve: (id: string, hid: string, b: { adjustedAmount: number; notes?: string }) => api.patch(`${m(id)}/handovers/${hid}/resolve`, b),
};

export const shopLink = {
  get: (id: string) => api.get<{ link: T.MessShopLink | null }>(`${m(id)}/shop-link`),
  linkShop: (id: string, shopId: string) => api.put<{ link: T.MessShopLink }>(`${m(id)}/shop-link`, { shopId }),
  update: (id: string, defaultExpenseCategoryId: string) => api.patch(`${m(id)}/shop-link`, { defaultExpenseCategoryId }),
  failed: (id: string) => api.get<{ records: T.IntegrationRecord[] }>(`${m(id)}/shop-link/failed-integrations`),
  retry: (id: string, rid: string) => api.post(`${m(id)}/shop-link/integrations/${rid}/retry`),
};

export const shopOrders = {
  list: (id: string, status?: string) => api.get<{ orders: T.ShopOrder[] }>(`${m(id)}/shop-orders`, { status }),
  get: (id: string, oid: string) => api.get<{ order: T.ShopOrder }>(`${m(id)}/shop-orders/${oid}`),
  create: (id: string, b: { orderLines: { productId: string; quantity: number }[]; notes?: string }) => api.post(`${m(id)}/shop-orders`, b),
  replaceLines: (id: string, oid: string, orderLines: { productId: string; quantity: number }[]) => api.patch(`${m(id)}/shop-orders/${oid}/lines`, { orderLines }),
  place: (id: string, oid: string) => api.patch(`${m(id)}/shop-orders/${oid}/place`),
  cancel: (id: string, oid: string, reason: string) => api.patch(`${m(id)}/shop-orders/${oid}/cancel`, { reason }),
};

export const shops = {
  list: () => api.get<{ shops: T.Shop[] }>('/shops'),
  get: (sid: string) => api.get<{ shop: T.Shop }>(`/shops/${sid}`),
  create: (b: Q) => api.post('/shops', b),
  update: (sid: string, b: Q) => api.patch(`/shops/${sid}`, b),
  reassign: (sid: string, managedByUserId: string) => api.patch(`/shops/${sid}/admin`, { managedByUserId }),
  products: (sid: string, activeOnly = false) => api.get<{ products: T.Product[] }>(`/shops/${sid}/products`, { activeOnly }),
  createProduct: (sid: string, b: Q) => api.post(`/shops/${sid}/products`, b),
  updateProduct: (sid: string, pid: string, b: Q) => api.patch(`/shops/${sid}/products/${pid}`, b),
  orders: (sid: string, status?: string) => api.get<{ orders: T.ShopOrder[] }>(`/shops/${sid}/orders`, { status }),
  order: (sid: string, oid: string) => api.get<{ order: T.ShopOrder }>(`/shops/${sid}/orders/${oid}`),
  confirmOrder: (sid: string, oid: string) => api.patch(`/shops/${sid}/orders/${oid}/confirm`),
  processOrder: (sid: string, oid: string) => api.patch(`/shops/${sid}/orders/${oid}/process`),
  deliver: (sid: string, oid: string, b: { lines: { orderLineId: string; deliveredQuantity: number }[]; notes?: string }) => api.patch(`/shops/${sid}/orders/${oid}/deliver`, b),
  refund: (sid: string, oid: string, b: { refundAmount: number; reason: string }) => api.patch(`/shops/${sid}/orders/${oid}/refund`, b),
};

export const vendors = {
  list: () => api.get<{ vendors: T.Vendor[] }>('/vendors'),
  create: (name: string) => api.post('/vendors', { name }),
};
