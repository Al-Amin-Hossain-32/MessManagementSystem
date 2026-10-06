'use client';
import { useState } from 'react';
import { z } from 'zod';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { useMess } from '@/lib/use-mess';
import { Button, Card, Chip, Dt, Empty, ErrorBox, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { FormDialog } from '@/components/dialogs';
import type { BillingPaymentRequest } from '@/lib/types';

const METHODS = ['BKASH', 'NAGAD', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const PLANS = ['BASIC', 'STANDARD', 'PREMIUM'];

export default function BillingPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const billing = useQ(['billing', messId], () => E.billing.get(messId), access.isOwner);
  const requests = useQ(['billing-requests', messId, page], () => E.billing.list(messId, { page, limit: 20 }), access.isOwner);
  const submit = useAct((body: { plan: string; amount: number; method: string; paymentReference: string; proofUrl?: string; notes?: string }) =>
    E.billing.createRequest(messId, body), { ok: 'billing.submitted' });
  if (!access.isOwner) return <Empty title={t('err.FORBIDDEN')} />;
  return (
    <>
      <PageHeader title={t('nav.billing')} desc={t('billing.desc')} actions={<Button onClick={() => setOpen(true)}>{t('billing.submitPayment')}</Button>} />
      {billing.isLoading ? <Skeleton rows={3} /> : billing.isError ? (
        <ErrorBox error={billing.error} onRetry={() => { void billing.refetch(); }} />
      ) : billing.data ? (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-bold">{t('billing.currentPlan')}</h2>
                <p className="mt-1 font-head text-xl font-bold">{t(`st.${billing.data.subscription?.plan ?? 'BASIC'}`)}</p>
                <p className="mt-1 text-sm text-muted">{t('billing.periodEnds')}: <Dt v={billing.data.subscription.currentPeriodEnd} /></p></div>
              <Chip>{t(`st.${billing.data.subscription?.status ?? 'TRIAL'}`)}</Chip>
            </div>
            <p className="mt-4 rounded-xl bg-paper/70 p-3 text-sm text-muted">{t('billing.manualNotice')}</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">{t('billing.history')}</h2>
            {requests.isLoading ? <Skeleton rows={3} /> : requests.isError ? <ErrorBox error={requests.error} onRetry={() => { void requests.refetch(); }} /> :
              requests.data?.requests.length ? <>
                <RequestList requests={requests.data.requests} />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{t('audit.page', { page: requests.data.page, total: requests.data.total })}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('common.previous')}</Button>
                    <Button size="sm" variant="ghost" disabled={!requests.data.hasMore} onClick={() => setPage((current) => current + 1)}>{t('common.next')}</Button>
                  </div>
                </div>
              </> : <Empty title={t('billing.noRequests')} />}
          </Card>
        </div>
      ) : null}
      <FormDialog open={open} onClose={() => setOpen(false)} title={t('billing.submitPayment')} submitLabel={t('common.submit')}
        desc={t('billing.paymentFormHint')}
        schema={z.object({
          plan: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
          amount: z.number().positive(),
          method: z.enum(['BKASH', 'NAGAD', 'BANK_TRANSFER', 'CASH', 'OTHER']),
          paymentReference: z.string().min(3).max(120),
          proofUrl: z.string().url().optional(),
          notes: z.string().max(1000).optional(),
        })}
        fields={[
          { name: 'plan', label: t('billing.plan'), type: 'select', required: true, options: PLANS.map((value) => ({ value, label: t(`st.${value}`) })) },
          { name: 'amount', label: t('common.amount'), type: 'number', required: true, min: '0.01', step: '0.01' },
          { name: 'method', label: t('billing.method'), type: 'select', required: true, options: METHODS.map((value) => ({ value, label: t(`billing.method.${value}`) })) },
          { name: 'paymentReference', label: t('billing.reference'), required: true },
          { name: 'proofUrl', label: t('billing.proofUrl'), hint: t('billing.proofHint') },
          { name: 'notes', label: t('common.notes'), type: 'textarea' },
        ]}
        onSubmit={(body) => submit.mutateAsync(body as { plan: string; amount: number; method: string; paymentReference: string; proofUrl?: string; notes?: string })} />
    </>
  );
}

function RequestList({ requests }: { requests: BillingPaymentRequest[] }) {
  const { t } = useT();
  return <ul className="divide-y divide-line/70">
    {requests.map((request) => (
      <li key={request.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0"><p className="font-medium">{t(`st.${request.plan}`)} · {request.amount} · {t(`billing.method.${request.method}`)}</p>
          <p className="break-all text-sm text-muted">{t('billing.reference')}: {request.paymentReference}</p>
          {request.reviewNote && <p className="mt-1 text-sm text-muted">{request.reviewNote}</p>}</div>
        <div className="flex items-center justify-between gap-3 sm:justify-end"><Dt v={request.requestedAt} /><StatusBadge value={request.status} /></div>
      </li>
    ))}
  </ul>;
}
