'use client';
import { useParams } from 'next/navigation';
import { useMessAccess } from './access';
import * as E from './endpoints';
import { useQ } from './hooks';

export function useMess() {
  const { messId } = useParams<{ messId: string }>();
  return { messId, access: useMessAccess(messId) };
}
/** Current accounting period (null until the first meal/expense/payment lazily creates one). */
export const useCurrentPeriod = (messId: string) =>
  useQ(['period', messId], async () => (await E.accounting.current(messId)).period);
/** Active boarders — only callable by admin/manager (GET /members). */
export const useBoarders = (messId: string, enabled: boolean, status = 'ACTIVE') =>
  useQ(['boarders', messId, status], async () => (await E.members.list(messId, status)).boarders, enabled);
