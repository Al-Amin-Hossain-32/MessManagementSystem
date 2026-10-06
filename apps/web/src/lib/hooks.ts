'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useT } from '@/i18n';
import { useToast } from '@/components/toast';
import { errorMessage } from './errors';
import { useSession } from './session';

/** Thin wrapper so pages read `useQ(['meals', id], () => E.meals.day(...))`. */
export function useQ<T>(key: unknown[], fn: () => Promise<T>, enabled = true) {
  return useQuery({ queryKey: key, queryFn: fn, enabled, retry: false });
}

/**
 * Mutation with toast feedback. After success every active query refetches
 * (small app → correctness over micro-optimised cache surgery) and the user
 * context is reloaded when `reloadCtx` is set (memberships/assignments changed).
 */
export function useAct<A = void>(
  fn: (arg: A) => Promise<unknown>,
  opts: { ok?: string; reloadCtx?: boolean; onDone?: () => void } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useT();
  const { reload } = useSession();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      if (opts.ok) toast(t(opts.ok));
      if (opts.reloadCtx) await reload().catch(() => {});
      await qc.invalidateQueries();
      opts.onDone?.();
    },
    onError: (e) => toast(errorMessage(e, t), 'err'),
  });
}
