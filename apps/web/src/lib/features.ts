import {
  LayoutDashboard, Utensils, UserPlus, Receipt, Wallet, BookOpenText, Landmark, Users, UserCog,
  Handshake, MessageSquareWarning, ShoppingBasket, Settings, CreditCard, ScrollText, Building2,
  MessageSquareText, type LucideIcon,
} from 'lucide-react';
import type { MessAccess } from './access';

/**
 * Feature registry — the ONLY place that knows which Mess modules exist.
 * - status 'live'    : backed by real API routes today; page lives in app/(app)/mess/[messId]/<path>
 * - status 'planned' : no backend yet → rendered as a "coming soon" page via /coming/<id>
 * To add a module later: implement its endpoints in lib/endpoints.ts, add its page folder, flip
 * status to 'live' (or add a new entry). Sidebar, bottom bar and route gating derive from this list.
 */
export interface Feature {
  id: string; path: string; icon: LucideIcon; labelKey: string; group: 'main' | 'money' | 'people' | 'more';
  status: 'live' | 'planned'; show: (a: MessAccess) => boolean; primary?: boolean; // primary → mobile bottom bar
}

const any = (a: MessAccess) => a.isAdmin || a.isManager || a.isBoarder;
const finance = (a: MessAccess) => any(a) || a.isDirector;

export const MESS_FEATURES: Feature[] = [
  { id: 'dashboard', path: '', icon: LayoutDashboard, labelKey: 'nav.dashboard', group: 'main', status: 'live', show: finance, primary: true },
  { id: 'meals', path: 'meals', icon: Utensils, labelKey: 'nav.meals', group: 'main', status: 'live', show: any, primary: true },
  { id: 'chat', path: 'chat', icon: MessageSquareText, labelKey: 'nav.chat', group: 'main', status: 'live', show: any, primary: true },
  { id: 'guest-meals', path: 'guest-meals', icon: UserPlus, labelKey: 'nav.guestMeals', group: 'main', status: 'live', show: any },
  { id: 'expenses', path: 'expenses', icon: Receipt, labelKey: 'nav.expenses', group: 'money', status: 'live', show: finance, primary: true },
  { id: 'payments', path: 'payments', icon: Wallet, labelKey: 'nav.payments', group: 'money', status: 'live', show: finance, primary: true },
  { id: 'statements', path: 'statements', icon: BookOpenText, labelKey: 'nav.statements', group: 'money', status: 'live', show: (a) => a.isBoarder || a.isAdmin || a.isDirector },
  { id: 'accounting', path: 'accounting', icon: Landmark, labelKey: 'nav.accounting', group: 'money', status: 'live', show: (a) => a.isAdmin || a.isDirector },
  { id: 'shop-orders', path: 'shop-orders', icon: ShoppingBasket, labelKey: 'nav.shopOrders', group: 'money', status: 'live', show: (a) => a.isStaff },
  { id: 'members', path: 'members', icon: Users, labelKey: 'nav.members', group: 'people', status: 'live', show: (a) => a.isStaff },
  { id: 'managers', path: 'managers', icon: UserCog, labelKey: 'nav.managers', group: 'people', status: 'live', show: any },
  { id: 'handovers', path: 'handovers', icon: Handshake, labelKey: 'nav.handovers', group: 'people', status: 'live', show: (a) => a.isStaff },
  { id: 'disputes', path: 'disputes', icon: MessageSquareWarning, labelKey: 'nav.disputes', group: 'people', status: 'live', show: any },
  { id: 'settings', path: 'settings', icon: Settings, labelKey: 'nav.settings', group: 'more', status: 'live', show: (a) => a.isAdmin },
  { id: 'billing', path: 'billing', icon: CreditCard, labelKey: 'nav.billing', group: 'more', status: 'live', show: (a) => a.isOwner },
  { id: 'audit', path: 'audit', icon: ScrollText, labelKey: 'nav.audit', group: 'more', status: 'live', show: (a) => a.isAdmin },
  { id: 'directors', path: 'directors', icon: Building2, labelKey: 'nav.directors', group: 'more', status: 'live', show: (a) => a.isOwner },
];

export const PLANNED_NOTES: Record<string, string> = {};

export const SHOP_FEATURES = [
  { id: 'products', labelKey: 'nav.products' },
  { id: 'orders', labelKey: 'nav.shopFulfillment' },
];
