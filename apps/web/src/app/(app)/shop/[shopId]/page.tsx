'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { toAsciiDigits } from '@/lib/format';
import { Async, Button, Card, Chip, Dt, Empty, Field, Input, Money, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog, Modal } from '@/components/dialogs';
import type { Product, ShopOrder } from '@/lib/types';

const STOCK = ['IN_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED'];
type Tab = 'orders' | 'products';

export default function ShopConsole() {
  const { shopId } = useParams<{ shopId: string }>();
  const { t } = useT();
  const { ctx } = useSession();
  const [tab, setTab] = useState<Tab>('orders');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const managed = ctx?.shopsManaged.some((s) => s.shopId === shopId) || ctx?.isPlatformAdmin;
  const shop = useQ(['shop', shopId], () => E.shops.get(shopId), !!managed);
  const updateShop = useAct((payload: { name: string; status: string }) => E.shops.update(shopId, payload), { ok: 'common.saved' });
  if (!managed) return <Empty title={t('err.TENANT_ACCESS_DENIED')} />;
  return (
    <>
      <PageHeader title={shop.data?.shop.name ?? t('nav.shops')} desc={t('shop.desc')} actions={shop.data && <>
        <StatusBadge value={shop.data.shop.status} />
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>{t('shop.settings')}</Button>
      </>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'orders', label: t('nav.shopFulfillment') }, { id: 'products', label: t('nav.products') }]} />
      {tab === 'orders' ? <Orders shopId={shopId} /> : <Products shopId={shopId} />}
      <FormDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('shop.settings')}
        initial={{ name: shop.data?.shop.name ?? '', status: shop.data?.shop.status ?? 'ACTIVE' }}
        fields={[
          { name: 'name', label: t('common.name'), required: true },
          { name: 'status', label: t('common.status'), type: 'select', required: true, options: ['ACTIVE', 'SUSPENDED', 'CLOSED'].map((status) => ({ value: status, label: t(`st.${status}`) })) },
        ]}
        onSubmit={(payload) => updateShop.mutateAsync({ name: String(payload.name), status: String(payload.status) })} />
    </>
  );
}

function Products({ shopId }: { shopId: string }) {
  const { t } = useT();
  const [edit, setEdit] = useState<Product | 'new' | null>(null);
  const q = useQ(['products', shopId, 'all'], () => E.shops.products(shopId, false));
  const save = useAct((p: Record<string, unknown>) => (edit === 'new' ? E.shops.createProduct(shopId, p) : E.shops.updateProduct(shopId, (edit as Product).id, p)), { ok: 'common.saved' });
  const p = edit && edit !== 'new' ? edit : null;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit('new')}>{t('shop.addProduct')}</Button></div>
      <Async q={q}>{(d) => (
        <DataTable rows={d.products} rowKey={(r) => r.id} empty={t('shop.noProducts')}
          cols={[{ key: 'n', header: t('common.name'), cell: (r) => <span>{r.name} {!r.isActive && <Chip>{t('common.inactive')}</Chip>}</span>, primary: true },
            { key: 'c', header: t('exp.category'), cell: (r) => r.category || '—' }, { key: 'p', header: t('shop.price'), cell: (r) => <span><Money v={r.basePrice} /> / {r.unit}</span> },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.stockStatus} /> }]}
          actions={(r) => <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>{t('common.edit')}</Button>} />)}</Async>
      <FormDialog open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? t('shop.addProduct') : t('common.edit')}
        schema={z.object({ name: z.string().min(2).max(150), unit: z.string().min(1).max(20), basePrice: z.number().positive() })}
        initial={p ? { name: p.name, category: p.category ?? '', unit: p.unit, basePrice: String(Number(p.basePrice)), stockStatus: p.stockStatus, isActive: p.isActive } : { stockStatus: 'IN_STOCK' }}
        fields={[{ name: 'name', label: t('common.name'), required: true }, { name: 'category', label: t('exp.category') }, { name: 'unit', label: t('shop.unit'), required: true, placeholder: 'kg' },
          { name: 'basePrice', label: t('shop.price'), type: 'number', required: true }, { name: 'stockStatus', label: t('shop.stock'), type: 'select', required: true, options: STOCK.map((s) => ({ value: s, label: t(`st.${s}`) })) },
          ...(p ? [{ name: 'isActive', label: t('common.active'), type: 'checkbox' as const, hint: t('common.active') }] : [])]}
        onSubmit={(b) => save.mutateAsync(b)} />
    </div>
  );
}

function Orders({ shopId }: { shopId: string }) {
  const { t } = useT();
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const [deliver, setDeliver] = useState<string | null>(null);
  const [refund, setRefund] = useState<string | null>(null);
  const q = useQ(['sorders', shopId, status], () => E.shops.orders(shopId, status));
  const confirm = useAct((id: string) => E.shops.confirmOrder(shopId, id), { ok: 'common.done' });
  const process = useAct((id: string) => E.shops.processOrder(shopId, id), { ok: 'common.done' });
  const ref = useAct((a: { id: string; refundAmount: number; reason: string }) => E.shops.refund(shopId, a.id, { refundAmount: a.refundAmount, reason: a.reason }), { ok: 'shop.refunded' });
  const det = useQ(['sorders', shopId, 'd', detail], () => E.shops.order(shopId, detail!), !!detail);
  return (
    <div className="space-y-4">
      <Field label={t('common.status')}><Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto"><option value="">{t('common.all')}</option>
        {['PLACED', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select></Field>
      <Async q={q}>{(d) => (
        <DataTable rows={d.orders} rowKey={(r) => r.id} empty={t('so.none')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.placedAt ?? r.createdAt} />, primary: true }, { key: 't', header: t('common.total'), cell: (r) => <Money v={r.totalAmount} className="font-medium" /> },
            { key: 'v', header: t('so.delivered'), cell: (r) => <Money v={r.deliveredAmount} /> }, { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r: ShopOrder) => (<>
            <Button size="sm" variant="quiet" onClick={() => setDetail(r.id)}>{t('common.details')}</Button>
            {r.status === 'PLACED' && <Button size="sm" onClick={() => confirm.mutate(r.id)}>{t('common.confirm')}</Button>}
            {r.status === 'CONFIRMED' && <Button size="sm" onClick={() => process.mutate(r.id)}>{t('shop.startProcessing')}</Button>}
            {['PROCESSING', 'PARTIALLY_DELIVERED'].includes(r.status) && <Button size="sm" onClick={() => setDeliver(r.id)}>{t('shop.recordDelivery')}</Button>}
            {['DELIVERED', 'PARTIALLY_DELIVERED'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setRefund(r.id)}>{t('shop.refund')}</Button>}</>)} />)}</Async>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('common.details')} wide>
        <Async q={det}>{(d) => (
          <div className="space-y-4">
            <Card className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><p className="text-xs text-muted">{t('common.status')}</p><StatusBadge value={d.order.status} /></div>
              <div><p className="text-xs text-muted">{t('common.total')}</p><Money v={d.order.totalAmount} className="font-semibold" /></div>
              <div><p className="text-xs text-muted">{t('so.delivered')}</p><Money v={d.order.deliveredAmount} className="font-semibold" /></div>
            </Card>
            <ul className="divide-y divide-line text-sm">{(d.order.orderLines ?? d.order.lines ?? []).map((line) => {
              const quantity = Number(line.quantity);
              const delivered = Number(line.deliveredQuantity);
              const progress = quantity > 0 ? Math.min(100, delivered / quantity * 100) : 0;
              return (
                <li key={line.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{line.productNameSnapshot}</span>
                    <span className="num text-muted">{quantity} × <Money v={line.unitPriceSnapshot} /> · {t('so.delivered')}: {delivered} / {quantity}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>
                </li>
              );
            })}</ul>
          </div>)}</Async>
      </Modal>
      {deliver && <DeliverModal shopId={shopId} orderId={deliver} onClose={() => setDeliver(null)} />}
      <FormDialog open={!!refund} onClose={() => setRefund(null)} title={t('shop.refund')} danger
        fields={[{ name: 'refundAmount', label: t('common.amount'), type: 'number', required: true }, { name: 'reason', label: t('common.reason'), type: 'textarea', required: true }]}
        schema={z.object({ refundAmount: z.number().positive(), reason: z.string().min(3).max(500) })} onSubmit={(p) => ref.mutateAsync({ id: refund!, refundAmount: p.refundAmount, reason: p.reason })} />
    </div>
  );
}

/** Delivery is incremental: each line's quantity is added to what was already delivered. */
function DeliverModal({ shopId, orderId, onClose }: { shopId: string; orderId: string; onClose: () => void }) {
  const { t } = useT();
  const q = useQ(['sorders', shopId, 'd', orderId], () => E.shops.order(shopId, orderId));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const act = useAct((b: { lines: { orderLineId: string; deliveredQuantity: number }[]; notes?: string }) => E.shops.deliver(shopId, orderId, b), { ok: 'shop.delivered', onDone: onClose });
  const submit = (lines: { id: string }[]) => {
    const entered = lines.map((line) => ({ line, raw: toAsciiDigits(qty[line.id] ?? '').trim() })).filter((entry) => entry.raw.length > 0);
    if (entered.some((entry) => !Number.isFinite(Number(entry.raw)))) return setErr(t('common.invalidNumber'));
    const payload = entered.map(({ line, raw }) => ({ orderLineId: line.id, deliveredQuantity: Number(raw) }));
    if (!payload.length) return setErr(t('shop.enterQty'));
    if (payload.some((line) => !(line.deliveredQuantity > 0))) return setErr(t('shop.enterQty'));
    const orderLines = q.data?.order.orderLines ?? q.data?.order.lines ?? [];
    if (payload.some((line) => {
      const orderLine = orderLines.find((candidate) => candidate.id === line.orderLineId);
      return !orderLine || line.deliveredQuantity > Number(orderLine.quantity) - Number(orderLine.deliveredQuantity);
    })) return setErr(t('shop.exceedsRemaining'));
    setErr(''); act.mutate({ lines: payload, ...(notes.trim() ? { notes: notes.trim() } : {}) });
  };
  return (
    <Modal open onClose={onClose} title={t('shop.recordDelivery')} wide>
      <Async q={q}>{(d) => {
        const lines = d.order.orderLines ?? d.order.lines ?? [];
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t('shop.deliverHint')}</p>
            {lines.map((l) => (
              <Card key={l.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_9rem] sm:items-end">
                <div><p className="font-medium">{l.productNameSnapshot}</p><p className="num text-xs text-muted">{t('shop.ordered')}: {Number(l.quantity)} · {t('so.delivered')}: {Number(l.deliveredQuantity)} · {t('shop.remaining')}: {Number(l.quantity) - Number(l.deliveredQuantity)}</p></div>
                <Field label={t('shop.thisBatch')}><Input inputMode="decimal" value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></Field>
              </Card>))}
            <Field label={t('common.notes')}><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {err && <p role="alert" className="text-sm text-morich">{err}</p>}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button busy={act.isPending} onClick={() => submit(lines)}>{t('common.save')}</Button></div>
          </div>);
      }}</Async>
    </Modal>
  );
}
