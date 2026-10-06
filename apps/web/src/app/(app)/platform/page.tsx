'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Async, Button, Chip, Empty, Field, Input, PageHeader, Select, StatusBadge, Tabs } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog, Modal } from '@/components/dialogs';
import { ShopAdminPicker } from '@/components/shop-admin-picker';
import type { BillingPaymentRequest, Shop, ShopAdminCandidate, Vendor } from '@/lib/types';

type Tab = 'shops' | 'vendors' | 'billing';

export default function PlatformPage() {
  const { t } = useT();
  const { ctx } = useSession();
  const [tab, setTab] = useState<Tab>('shops');
  const [shopDlg, setShopDlg] = useState(false);
  const [vendorDlg, setVendorDlg] = useState(false);
  const [edit, setEdit] = useState<Shop | null>(null);
  const [reassign, setReassign] = useState<Shop | null>(null);
  const shops = useQ(['shops'], E.shops.list, !!ctx?.isPlatformAdmin);
  const vendors = useQ(['vendors'], E.vendors.list, !!ctx?.isPlatformAdmin);
  const createShop = useAct((p: Record<string, unknown>) => E.shops.create(p), { ok: 'common.created', reloadCtx: true });
  const updShop = useAct((p: Record<string, unknown>) => E.shops.update(edit!.id, p), { ok: 'common.saved' });
  const reass = useAct((id: string) => E.shops.reassign(reassign!.id, id), { ok: 'common.saved', reloadCtx: true });
  const createVendor = useAct((name: string) => E.vendors.create(name), { ok: 'common.created' });
  if (!ctx?.isPlatformAdmin) return <Empty title={t('err.FORBIDDEN')} />;
  return (
    <>
      <PageHeader title={t('nav.platform')} desc={t('plat.desc')} actions={tab === 'shops' ? <Button onClick={() => setShopDlg(true)}>{t('plat.addShop')}</Button> : tab === 'vendors' ? <Button onClick={() => setVendorDlg(true)}>{t('plat.addVendor')}</Button> : undefined} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'shops', label: t('nav.shops') }, { id: 'vendors', label: t('plat.vendors') }, { id: 'billing', label: t('platform.billingReview') }]} />
      {tab === 'shops' ? (
        <Async q={shops}>{(d) => (
          <DataTable rows={d.shops} rowKey={(r) => r.id} empty={t('plat.noShops')}
            cols={[{ key: 'n', header: t('common.name'), cell: (r) => <span>{r.name} {r.isDefault && <Chip>{t('plat.default')}</Chip>}</span>, primary: true }, { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
            actions={(r) => (<><Button size="sm" variant="ghost" onClick={() => setEdit(r)}>{t('common.edit')}</Button><Button size="sm" variant="ghost" onClick={() => setReassign(r)}>{t('plat.reassign')}</Button></>)} />)}</Async>
      ) : tab === 'vendors' ? (
        <Async q={vendors}>{(d) => (
          <DataTable rows={d.vendors} rowKey={(r) => r.id} empty={t('plat.noVendors')}
            cols={[{ key: 'n', header: t('common.name'), cell: (r) => <span>{r.name} {r.isPlatformOwned && <Chip>{t('plat.platformOwned')}</Chip>}</span>, primary: true }, { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]} />)}</Async>
      ) : <BillingQueue />}
      <ShopAssignmentDialog
        open={shopDlg}
        mode="create"
        vendors={vendors.data?.vendors ?? []}
        onClose={() => setShopDlg(false)}
        onSubmit={(payload) => createShop.mutateAsync(payload)}
      />
      <FormDialog open={!!edit} onClose={() => setEdit(null)} title={t('common.edit')} initial={{ name: edit?.name ?? '', status: edit?.status ?? '' }}
        fields={[{ name: 'name', label: t('common.name') }, { name: 'status', label: t('common.status'), type: 'select', options: ['ACTIVE', 'SUSPENDED', 'CLOSED'].map((s) => ({ value: s, label: t(`st.${s}`) })) }]} onSubmit={(p) => updShop.mutateAsync(p)} />
      <ShopAssignmentDialog
        open={!!reassign}
        mode="reassign"
        vendors={[]}
        onClose={() => setReassign(null)}
        onSubmit={(payload) => reass.mutateAsync(String(payload.managedByUserId))}
      />
      <FormDialog open={vendorDlg} onClose={() => setVendorDlg(false)} title={t('plat.addVendor')} submitLabel={t('common.create')} schema={z.object({ name: z.string().min(2).max(150) })}
        fields={[{ name: 'name', label: t('common.name'), required: true }]} onSubmit={(p) => createVendor.mutateAsync(p.name)} />
    </>
  );
}

function ShopAssignmentDialog({
  open,
  mode,
  vendors,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'reassign';
  vendors: Vendor[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [user, setUser] = useState<ShopAdminCandidate | null>(null);
  const [vendorId, setVendorId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [nameError, setNameError] = useState('');
  const [userError, setUserError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setUser(null);
    setVendorId('');
    setIsDefault(false);
    setNameError('');
    setUserError('');
  }, [open, mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const nextNameError = mode === 'create' && (cleanName.length < 2 || cleanName.length > 100)
      ? t('plat.shopNameInvalid')
      : '';
    const nextUserError = user ? '' : t('common.required');
    setNameError(nextNameError);
    setUserError(nextUserError);
    if (nextNameError || nextUserError || !user) return;

    setBusy(true);
    try {
      await onSubmit(mode === 'create'
        ? {
            name: cleanName,
            managedByUserId: user.id,
            ...(vendorId ? { vendorId } : {}),
            isDefault,
          }
        : { managedByUserId: user.id });
      onClose();
    } catch {
      // The mutation hook reports the API error; keep the dialog open for correction.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('plat.addShop') : t('plat.reassign')}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === 'create' && (
          <>
            <Field label={t('common.name')} error={nameError}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
                aria-invalid={!!nameError || undefined}
              />
            </Field>
            <Field label={t('plat.vendor')} hint={t('plat.vendorHint')}>
              <Select value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                <option value="">—</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </Select>
            </Field>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]"
              />
              <span><span className="block font-medium">{t('plat.default')}</span><span className="text-xs text-muted">{t('plat.defaultHint')}</span></span>
            </label>
          </>
        )}
        <ShopAdminPicker value={user} onChange={(nextUser) => {
          setUser(nextUser);
          setUserError('');
        }} error={userError} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" busy={busy}>
            {mode === 'create' ? t('common.create') : t('plat.reassign')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BillingQueue() {
  const { t } = useT();
  const [reject, setReject] = useState<BillingPaymentRequest | null>(null);
  const queue = useQ(['platform-billing-requests'], () => E.billing.platformList({ status: 'PENDING' }));
  const approve = useAct((id: string) => E.billing.approve(id), { ok: 'common.done' });
  const rejectRequest = useAct((a: { id: string; reason: string }) => E.billing.reject(a.id, a.reason), { ok: 'common.done' });
  return (
    <>
      <Async q={queue}>{(data) => (
        <DataTable rows={data.requests} rowKey={(r) => r.id} empty={t('platform.noBillingRequests')}
          cols={[
            { key: 'mess', header: t('platform.mess'), cell: (r) => r.mess?.name ?? '—', primary: true },
            { key: 'user', header: t('platform.requester'), cell: (r) => r.requester?.name ?? '—' },
            { key: 'plan', header: t('billing.plan'), cell: (r) => t(`st.${r.plan}`) },
            { key: 'amount', header: t('common.amount'), cell: (r) => r.amount },
            { key: 'method', header: t('billing.method'), cell: (r) => t(`billing.method.${r.method}`) },
            { key: 'ref', header: t('platform.paymentReference'), cell: (r) => <span className="break-all">{r.paymentReference}</span> },
            { key: 'date', header: t('common.date'), cell: (r) => new Date(r.requestedAt).toLocaleDateString() },
            { key: 'proof', header: t('billing.proofUrl'), cell: (r) => r.proofUrl ? <a className="text-brand underline" href={r.proofUrl} target="_blank" rel="noreferrer">{t('common.details')}</a> : '—' },
          ]}
          actions={(r) => <><Button size="sm" onClick={() => approve.mutate(r.id)}>{t('common.approve')}</Button><Button size="sm" variant="ghost" onClick={() => setReject(r)}>{t('common.reject')}</Button></>} />)}</Async>
      <ConfirmDialog open={!!reject} onClose={() => setReject(null)} title={t('common.reject')} reasonLabel={t('common.reason')}
        onConfirm={(reason) => rejectRequest.mutateAsync({ id: reject!.id, reason })} />
    </>
  );
}
