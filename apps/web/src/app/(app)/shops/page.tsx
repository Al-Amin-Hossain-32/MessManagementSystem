'use client';
import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useQ } from '@/lib/hooks';
import { Async, Button, Card, Empty, PageHeader, StatusBadge } from '@/components/ui';

export default function ShopDirectoryPage() {
  const { t } = useT();
  const shops = useQ(['shop-directory'], E.shops.list);

  return (
    <>
      <PageHeader title={t('shop.browse')} desc={t('shop.catalogDesc')} />
      <Async q={shops}>{(data) => {
        const activeShops = data.shops.filter((shop) => shop.status === 'ACTIVE');
        if (!activeShops.length) return <Empty title={t('shop.catalogEmpty')} />;
        return (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeShops.map((shop) => (
              <li key={shop.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Store className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-semibold">{shop.name}</h2>
                      <div className="mt-1"><StatusBadge value={shop.status} /></div>
                    </div>
                  </div>
                  <Link href={`/shops/${shop.id}`} className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-medium text-brand-ink transition-colors hover:bg-brand/90">
                    {t('common.details')}<ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        );
      }}</Async>
    </>
  );
}
