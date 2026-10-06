'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Search, Store } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useQ } from '@/lib/hooks';
import { Async, Button, Card, Chip, Empty, Field, Input, Money, PageHeader, StatusBadge } from '@/components/ui';
import { Modal } from '@/components/dialogs';
import type { Product } from '@/lib/types';

export default function ShopCatalogPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const shop = useQ(['public-shop', shopId], () => E.shops.get(shopId));
  const products = useQ(['public-shop-products', shopId], () => E.shops.products(shopId, true));

  return (
    <>
    <div className="mb-4">
      <Link href="/shops" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 font-medium text-brand hover:bg-brand-soft">
        <ArrowLeft className="h-4 w-4" aria-hidden />{t('shop.browse')}
      </Link>
    </div>
      <Async q={shop}>{(data) => {
        if (data.shop.status !== 'ACTIVE') return <Empty title={t('shop.catalogClosed')} />;
        return (
          <>
            <PageHeader title={data.shop.name} desc={t('shop.catalogDesc')} actions={<StatusBadge value={data.shop.status} />} />
            <div className="mb-5 max-w-xl">
              <Field label={t('shop.searchProducts')}>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
                </span>
              </Field>
            </div>
            <Async q={products}>{(productData) => {
              const query = search.trim().toLocaleLowerCase();
              const filteredProducts = query
                ? productData.products.filter((product) => `${product.name} ${product.category ?? ''}`.toLocaleLowerCase().includes(query))
                : productData.products;
              if (!filteredProducts.length) return <Empty title={search ? t('shop.noMatchingProducts') : t('shop.noProducts')} />;
              return (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <li key={product.id}>
                      <Card className="flex h-full flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Store className="h-5 w-5" aria-hidden /></span>
                          <div className="min-w-0 flex-1">
                            <h2 className="break-words font-semibold">{product.name}</h2>
                            {product.category && <p className="mt-0.5 text-sm text-muted">{product.category}</p>}
                          </div>
                          <StatusBadge value={product.stockStatus} />
                        </div>
                        <p className="num text-lg font-semibold"><Money v={product.basePrice} /> <span className="text-sm font-normal text-muted">/ {product.unit}</span></p>
                        <Button variant="ghost" className="mt-auto w-full" onClick={() => setSelected(product)}>{t('shop.productDetails')}</Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              );
            }}</Async>
          </>
        );
      }}</Async>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? t('shop.productDetails')}>
        {selected && (
          <div className="space-y-4">
            {selected.category && <p className="text-sm text-muted">{t('shop.category')}: {selected.category}</p>}
            <p className="text-xl font-semibold"><Money v={selected.basePrice} /> <span className="text-sm font-normal text-muted">/ {selected.unit}</span></p>
            <Chip>{t(`st.${selected.stockStatus}`)}</Chip>
          </div>
        )}
      </Modal>
    </>
  );
}
