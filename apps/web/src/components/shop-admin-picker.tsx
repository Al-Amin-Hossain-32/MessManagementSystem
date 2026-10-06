'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import type { ShopAdminCandidate } from '@/lib/types';
import { useQ } from '@/lib/hooks';
import { Button, Field, Input } from './ui';

export function ShopAdminPicker({
  value,
  onChange,
  error,
}: {
  value: ShopAdminCandidate | null;
  onChange: (user: ShopAdminCandidate | null) => void;
  error?: string;
}) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchTerm(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const results = useQ(
    ['shop-admin-search', searchTerm],
    () => E.userDirectory.searchForShopAdmin(searchTerm),
    searchTerm.length >= 2 && !value,
  );

  if (value) {
    return (
      <Field label={t('plat.shopAdmin')} error={error}>
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-brand/25 bg-brand-soft/30 px-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{value.name}</span>
            <span className="block truncate text-xs text-muted">{value.email}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            aria-label={t('plat.changeShopAdmin')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </Field>
    );
  }

  const normalizedQuery = query.trim();
  const waitingForDebounce = normalizedQuery !== searchTerm;
  return (
    <Field label={t('plat.shopAdmin')} htmlFor="shop-admin-search" error={error} hint={t('plat.shopAdminSearchHint')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
        <Input
          id="shop-admin-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('plat.shopAdminSearchPlaceholder')}
          aria-label={t('plat.shopAdmin')}
          aria-expanded={normalizedQuery.length >= 2}
          aria-controls={normalizedQuery.length >= 2 ? 'shop-admin-results' : undefined}
          aria-invalid={!!error || undefined}
          className="pl-9"
        />
        {(waitingForDebounce || results.isFetching) && normalizedQuery.length >= 2 && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted" aria-label={t('common.loading')} />
        )}
        {normalizedQuery.length >= 2 && (
          <div id="shop-admin-results" role="listbox" className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-20 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgb(29_43_38/0.14)]">
            {waitingForDebounce || (results.isLoading && !results.isError) ? (
              <div className="px-3 py-3 text-sm text-muted">{t('common.loading')}</div>
            ) : results.isError ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-morich">{t('plat.shopAdminSearchFailed')}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => results.refetch()}>{t('common.retry')}</Button>
              </div>
            ) : !results.data ? (
              <div className="px-3 py-3 text-sm text-muted">{t('common.loading')}</div>
            ) : results.data.users.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted">{t('plat.noShopAdminMatches')}</div>
            ) : (
              results.data.users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange(user);
                    setQuery('');
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper text-muted">
                    <UserRound className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                    <span className="block truncate text-xs text-muted">{user.email}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
