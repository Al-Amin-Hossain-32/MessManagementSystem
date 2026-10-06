'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import * as E from '@/lib/endpoints';
import { useAct, useQ } from '@/lib/hooks';
import { toAsciiDigits } from '@/lib/format';
import { useMess } from '@/lib/use-mess';
import { Async, Button, Card, Dt, Field, Input, Money, PageHeader, Select, StatusBadge } from '@/components/ui';
import { DataTable } from '@/components/table';
import { ConfirmDialog, FormDialog, Modal } from '@/components/dialogs';
import type { Handover, HandoverItem } from '@/lib/types';

const ITEM_TYPES = ['CASH_IN_HAND', 'ADVANCE_FUND', 'PETTY_CASH', 'PENDING_COLLECTION', 'OTHER'];

export default function HandoversPage() {
  const { messId, access } = useMess();
  const { t } = useT();
  const [create, setCreate] = useState(false);
  const [submitFor, setSubmitFor] = useState<Handover | null>(null);
  const [dispute, setDispute] = useState<string | null>(null);
  const [resolve, setResolve] = useState<string | null>(null);
  const q = useQ(['handovers', messId], () => E.handovers.list(messId));
  const mgrs = useQ(['mgr', messId, 'list'], () => E.managers.list(messId));
  const accept = useAct((id: string) => E.handovers.accept(messId, id), { ok: 'ho.accepted' });
  const sub = useAct((a: { id: string; incoming: string }) => E.handovers.submit(messId, a.id, a.incoming), { ok: 'ho.submitted' });
  const disp = useAct((a: { id: string; notes: string }) => E.handovers.dispute(messId, a.id, a.notes), { ok: 'ho.disputed' });
  const res = useAct((a: { id: string; p: any }) => E.handovers.resolve(messId, a.id, a.p), { ok: 'ho.resolved' });
  const candidates = (mgrs.data?.assignments ?? []).filter((a) => a.userId !== access.userId && (a.status === 'PENDING_ACCEPTANCE' || a.status === 'ACTIVE'));

  return (
    <>
      <PageHeader title={t('nav.handovers')} desc={t('ho.desc')} actions={access.isManager && <Button onClick={() => setCreate(true)}>{t('ho.start')}</Button>} />
      <Async q={q}>{(d) => (
        <DataTable rows={d.handovers} rowKey={(r) => r.id} empty={t('ho.none')}
          cols={[{ key: 'd', header: t('common.date'), cell: (r) => <Dt v={r.createdAt} />, primary: true },
            { key: 'f', header: t('ho.from'), cell: (r) => r.outgoingAssignment?.user?.name ?? '—' },
            { key: 'a', header: t('ho.declared'), cell: (r) => <Money v={r.totalDeclaredAmount} className="font-medium" /> },
            { key: 'c', header: t('ho.accepted'), cell: (r) => (r.acceptedAmount ? <Money v={r.acceptedAmount} /> : '—') },
            { key: 's', header: t('common.status'), cell: (r) => <StatusBadge value={r.status} /> }]}
          actions={(r) => (<>
            {r.status === 'DRAFT' && r.outgoingAssignment?.userId === access.userId && <Button size="sm" onClick={() => setSubmitFor(r)}>{t('ho.submit')}</Button>}
            {r.status === 'SUBMITTED' && r.outgoingAssignment?.userId !== access.userId && access.isManager && (<>
              <Button size="sm" onClick={() => accept.mutate(r.id)}>{t('common.accept')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setDispute(r.id)}>{t('ho.dispute')}</Button></>)}
            {r.status === 'DISPUTED' && access.isAdmin && <Button size="sm" onClick={() => setResolve(r.id)}>{t('ho.resolve')}</Button>}</>)} />)}</Async>
      <NewHandover open={create} onClose={() => setCreate(false)} messId={messId} />
      <FormDialog open={!!submitFor} onClose={() => setSubmitFor(null)} title={t('ho.submit')} submitLabel={t('common.submit')}
        fields={[{ name: 'incoming', label: t('ho.incoming'), type: 'select', required: true, options: candidates.map((a) => ({ value: a.id, label: `${a.user?.name ?? ''} — ${a.periodLabel}` })) }]}
        onSubmit={(p) => sub.mutateAsync({ id: submitFor!.id, incoming: p.incoming })} />
      <ConfirmDialog open={!!dispute} onClose={() => setDispute(null)} danger title={t('ho.dispute')} reasonLabel={t('ho.discrepancy')}
        onConfirm={(notes) => disp.mutateAsync({ id: dispute!, notes })} />
      <FormDialog open={!!resolve} onClose={() => setResolve(null)} title={t('ho.resolve')}
        fields={[{ name: 'adjustedAmount', label: t('ho.adjusted'), type: 'number', required: true }, { name: 'notes', label: t('common.notes'), type: 'textarea' }]}
        onSubmit={(p) => res.mutateAsync({ id: resolve!, p })} />
    </>
  );
}

/** Multi-row declaration (backend requires ≥1 declared item, each with amount > 0). */
function NewHandover({ open, onClose, messId }: { open: boolean; onClose: () => void; messId: string }) {
  const { t } = useT();
  const empty = { type: 'CASH_IN_HAND', declaredAmount: '', notes: '' };
  const [rows, setRows] = useState([empty]);
  const [err, setErr] = useState('');
  const create = useAct((items: HandoverItem[]) => E.handovers.create(messId, { declaredItems: items }), { ok: 'ho.created', onDone: () => { setRows([empty]); onClose(); } });
  const submit = () => {
    const items = rows.map((r) => ({ type: r.type, declaredAmount: Number(toAsciiDigits(r.declaredAmount)), ...(r.notes.trim() ? { notes: r.notes.trim() } : {}) })) as HandoverItem[];
    if (items.some((i) => !(Number(i.declaredAmount) > 0))) return setErr(t('ho.amountRequired'));
    setErr(''); create.mutate(items);
  };
  return (
    <Modal open={open} onClose={onClose} title={t('ho.start')} wide>
      <div className="space-y-3">
        <p className="text-sm text-muted">{t('ho.itemsHint')}</p>
        {rows.map((r, i) => (
          <Card key={i} className="space-y-2 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t('ho.itemType')}><Select value={r.type} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>{ITEM_TYPES.map((x) => <option key={x} value={x}>{t(`item.${x}`)}</option>)}</Select></Field>
              <Field label={t('common.amount')}><Input inputMode="decimal" value={r.declaredAmount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, declaredAmount: e.target.value } : x)))} /></Field>
            </div>
            <Field label={t('common.notes')}><Input value={r.notes} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} /></Field>
            {rows.length > 1 && <Button size="sm" variant="quiet" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" />{t('common.remove')}</Button>}
          </Card>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setRows([...rows, empty])}><Plus className="h-4 w-4" />{t('ho.addItem')}</Button>
        {err && <p role="alert" className="text-sm text-morich">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button busy={create.isPending} onClick={submit}>{t('common.save')}</Button></div>
      </div>
    </Modal>
  );
}
