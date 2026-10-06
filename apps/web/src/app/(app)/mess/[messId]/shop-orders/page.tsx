'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { toAsciiDigits } from '@/lib/format';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Card, Dt, Empty, Field, Input, Money, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog, Modal } from '@/components/dialogs';
import type { ShopOrder } from '@/lib/types';

type Tab = 'orders' | 'link';

export default function ShopOrdersPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('orders');
  const link = useQ(['shoplink', messId], () => E.shopLink.get(messId));
  const tabs = [{ id: 'orders' as Tab, label: t('so.orders') }, ...(access.isAdmin ? [{ id: 'link' as Tab, label: t('so.link') }] : [])];
  return (
    <>
      <PageHeader title={t('nav.shopOrders')} desc={t('so.desc')} />
      {tabs.length > 1 && <Tabs tabs={tabs} value={tab} onChange={setTab} />}
      {tab === 'orders' && <Orders messId={messId} shopId={link.data?.link?.shopId} />}
      {tab === 'link' && access.isAdmin && <LinkSettings messId={messId} />}
    </>
  );
}

function Orders({ messId, shopId }: { messId: string; shopId?: string }) {
  const { t } = useT();
  const { ctx } = useSession();
  const [status, setStatus] = useState('');
  const [create, setCreate] = useState(false);
  const [editOrder, setEditOrder] = useState<ShopOrder | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const q = useQ(['so', messId, status], () => E.shopOrders.list(messId, status));
  const det = useQ(['so', messId, 'd', detail], () => E.shopOrders.get(messId, detail!), !!detail);
  const place = useAct((id: string) => E.shopOrders.place(messId, id), { ok: 'so.placed' });
  const cancelAct = useAct((a: { id: string; reason: string }) => E.shopOrders.cancel(messId, a.id, a.reason), { ok: 'so.cancelled' });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t('common.status')}><Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">{t('common.all')}</option>
          {['DRAFT', 'PLACED', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select></Field>
        <Button disabled={!shopId} onClick={() => setCreate(true)}>{t('so.new')}</Button>
      </div>
      {!shopId && <p className="text-sm text-muted">{t('so.noShop')}</p>}
      <Async q={q}>{(d) => (
        <DataTable rows={d.orders} rowKey={(r) => r.id} empty={t('so.none')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.createdAt} />, primary: true }, { key: 't', header: t('common.total'), cell: (r) => <Money v={r.totalAmount} className="font-medium" /> },
            { key: 'v', header: t('so.delivered'), cell: (r) => <Money v={r.deliveredAmount} /> }, { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r: ShopOrder) => (<>
            <Button size="sm" variant="quiet" onClick={() => setDetail(r.id)}>{t('common.details')}</Button>
            {r.status === 'DRAFT' && r.placedBy === ctx?.userId && <Button size="sm" variant="ghost" onClick={() => setEditOrder(r)}>{t('common.edit')}</Button>}
            {r.status === 'DRAFT' && r.placedBy === ctx?.userId && <Button size="sm" onClick={() => place.mutate(r.id)}>{t('so.place')}</Button>}
            {['DRAFT', 'PLACED', 'CONFIRMED'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setCancel(r.id)}>{t('common.cancelOrder')}</Button>}</>)} />)}</Async>
      {shopId && <NewOrder open={create || !!editOrder} order={editOrder ?? undefined} onClose={() => { setCreate(false); setEditOrder(null); }} messId={messId} shopId={shopId} />}
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} danger title={t('common.cancelOrder')} reasonLabel={t('common.reason')} onConfirm={(reason) => cancelAct.mutateAsync({ id: cancel!, reason })} />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('common.details')} wide>
        <Async q={det}>{(d) => (
          <div className="space-y-4">
            <Card className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-muted">{t('common.status')}</p><StatusBadge value={d.order.status} /></div>
              <div><p className="text-xs text-muted">{t('common.total')}</p><Money v={d.order.totalAmount} className="font-semibold" /></div>
              <div><p className="text-xs text-muted">{t('so.delivered')}</p><Money v={d.order.deliveredAmount} className="font-semibold" /></div>
            </Card>
            {d.order.notes && <p className="text-sm text-muted">{d.order.notes}</p>}
            <ul className="divide-y divide-line text-sm">{(d.order.orderLines ?? d.order.lines ?? []).map((l) => {
              const quantity = Number(l.quantity);
              const delivered = Number(l.deliveredQuantity);
              const progress = quantity > 0 ? Math.min(100, delivered / quantity * 100) : 0;
              return (
                <li key={l.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{l.productNameSnapshot}</span>
                    <span className="num text-muted">{quantity} × <Money v={l.unitPriceSnapshot} /> · {t('so.delivered')}: {delivered} / {quantity}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
                </li>
              );
            })}</ul>
          </div>)}</Async>
      </Modal>
    </div>
  );
}

type OrderInput = { orderLines: { productId: string; quantity: number }[]; notes?: string };

function NewOrder({ open, order, onClose, messId, shopId }: { open: boolean; order?: ShopOrder; onClose: () => void; messId: string; shopId: string }) {
  const { t } = useT();
  const products = useQ(['products', shopId, order ? 'all' : 'active'], () => E.shops.products(shopId, !!order ? false : true), open);
  const [rows, setRows] = useState([{ productId: '', quantity: '' }]);
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setRows(order?.orderLines?.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })) ?? [{ productId: '', quantity: '' }]);
    setNotes(order?.notes ?? '');
    setErr('');
  }, [open, order]);
  const save = useAct((payload: OrderInput) => order
    ? E.shopOrders.replaceLines(messId, order.id, payload.orderLines)
    : E.shopOrders.create(messId, payload), {
    ok: order ? 'so.updated' : 'so.created',
    onDone: () => { setRows([{ productId: '', quantity: '' }]); setNotes(''); onClose(); },
  });
  const submit = () => {
    const lines = rows.map((r) => ({ productId: r.productId, quantity: Number(toAsciiDigits(r.quantity)) }));
    const selectedProductIds = lines.map((l) => l.productId).filter(Boolean);
    if (lines.some((l) => !l.productId || !Number.isFinite(l.quantity) || !(l.quantity > 0))) return setErr(t('so.lineRequired'));
    if (new Set(selectedProductIds).size !== selectedProductIds.length) return setErr(t('so.duplicateProduct'));
    if (order && lines.some((line) => !products.data?.products.find((product) => product.id === line.productId)?.isActive)) {
      return setErr(t('so.removeInactive'));
    }
    setErr('');
    save.mutate({ orderLines: lines, ...(!order && notes.trim() ? { notes: notes.trim() } : {}) });
  };
  const set = (i: number, k: 'productId' | 'quantity', v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Modal open={open} onClose={onClose} title={order ? t('so.editDraft') : t('so.new')} wide>
      <div className="space-y-3">
        {order && <p className="text-sm text-muted">{t('so.draftOnly')}</p>}
        {products.isLoading ? '…' : !products.data?.products.length ? <Empty title={t('so.noProducts')} /> : rows.map((r, i) => {
          const selectedIds = rows.filter((_, j) => j !== i).map((row) => row.productId).filter(Boolean);
          const productOptions = products.data.products.filter((product) => product.id === r.productId || !selectedIds.includes(product.id));
          return (
            <Card key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
              <Field label={t('so.product')}><Select value={r.productId} onChange={(e) => set(i, 'productId', e.target.value)}><option value="">{t('common.choose')}</option>
                {productOptions.map((p) => <option key={p.id} value={p.id} disabled={!p.isActive}>{p.name}{!p.isActive ? ` — ${t('common.inactive')}` : ''} ({Number(p.basePrice)}/{p.unit})</option>)}</Select></Field>
              <Field label={t('common.qty')}><Input inputMode="decimal" value={r.quantity} onChange={(e) => set(i, 'quantity', e.target.value)} /></Field>
              {rows.length > 1 && <Button variant="quiet" size="sm" aria-label={t('common.remove')} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
            </Card>
          );
        })}
        {products.data?.products.length ? <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { productId: '', quantity: '' }])}><Plus className="h-4 w-4" />{t('so.addLine')}</Button> : null}
        {!order && <Field label={t('common.notes')}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>}
        {err && <p role="alert" className="text-sm text-morich">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button busy={save.isPending} disabled={products.isLoading || !products.data?.products.length} onClick={submit}>{order ? t('common.save') : t('so.saveDraft')}</Button></div>
      </div>
    </Modal>
  );
}

function LinkSettings({ messId }: { messId: string }) {
  const { t } = useT();
  const [edit, setEdit] = useState(false);
  const [shopDialog, setShopDialog] = useState(false);
  const link = useQ(['shoplink', messId], () => E.shopLink.get(messId));
  const shops = useQ(['shops'], E.shops.list);
  const cats = useQ(['cats', messId], () => E.categories.list(messId));
  const failed = useQ(['failed', messId], () => E.shopLink.failed(messId));
  const setShop = useAct((shopId: string) => E.shopLink.linkShop(messId, shopId), { ok: 'so.shopLinked' });
  const upd = useAct((id: string) => E.shopLink.update(messId, id), { ok: 'common.saved' });
  const retry = useAct((id: string) => E.shopLink.retry(messId, id), { ok: 'so.retried' });
  const l = link.data?.link;
  const activeShops = (shops.data?.shops ?? []).filter((shop) => shop.status === 'ACTIVE');
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold">{t('so.linkedShop')}</h2>
            <p className="text-sm text-muted">{l ? `${l.shop?.name ?? l.shopId} · ${t('so.defaultCategory')}: ${cats.data?.categories.find((c) => c.id === l.defaultExpenseCategoryId)?.name ?? '—'}` : t('so.noShop')}</p></div>
          <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={shops.isLoading || !activeShops.length} onClick={() => setShopDialog(true)}>{l ? t('so.changeShop') : t('so.linkShop')}</Button>
            {l && <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>{t('so.defaultCategory')}</Button>}
          </div>
        </div>
        {!shops.isLoading && !activeShops.length && <p className="mt-3 text-sm text-muted">{t('so.noActiveShops')}</p>}
      </Card>
      <div>
        <h2 className="mb-3 text-lg font-bold">{t('so.failed')}</h2>
        <Async q={failed}>{(d) => (
          <DataTable rows={d.records} rowKey={(r) => r.id} empty={t('so.noFailed')}
            cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.createdAt} time />, primary: true }, { key: 'e', header: t('so.event'), cell: (r) => r.eventType }, { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.processingStatus} /> }, { key: 'r', header: t('common.reason'), cell: (r) => <span className="max-w-sm text-xs text-morich">{integrationFailureReason(r.errorLog) || '—'}</span> }]}
            actions={(r) => <Button size="sm" onClick={() => retry.mutate(r.id)}>{t('common.retry')}</Button>} />)}</Async>
      </div>
      <FormDialog open={edit} onClose={() => setEdit(false)} title={t('so.defaultCategory')} initial={{ defaultExpenseCategoryId: l?.defaultExpenseCategoryId ?? '' }}
        fields={[{ name: 'defaultExpenseCategoryId', label: t('so.defaultCategory'), type: 'select', required: true, options: (cats.data?.categories ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name })) }]}
        onSubmit={(p) => upd.mutateAsync(p.defaultExpenseCategoryId)} />
      <FormDialog open={shopDialog} onClose={() => setShopDialog(false)} title={l ? t('so.changeShop') : t('so.linkShop')}
        initial={{ shopId: l?.shopId ?? '' }}
        fields={[{ name: 'shopId', label: t('so.linkShop'), type: 'select', required: true, options: activeShops.map((shop) => ({ value: shop.id, label: shop.name })) }]}
        onSubmit={(payload) => setShop.mutateAsync(String(payload.shopId))} />
    </div>
  );
}

function integrationFailureReason(errorLog: unknown): string {
  if (typeof errorLog !== 'object' || errorLog === null || !('reason' in errorLog)) return '';
  return typeof errorLog.reason === 'string' ? errorLog.reason : '';
}
