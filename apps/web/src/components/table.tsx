'use client';
import type { ReactNode } from 'react';
import { Empty } from './ui';

export interface Col<T> { key: string; header: string; cell: (r: T) => ReactNode; primary?: boolean; className?: string }

/** Table on ≥md, stacked labelled cards on mobile — same column definitions drive both. */
export function DataTable<T>({ cols, rows, rowKey, empty, emptyHint, actions }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; empty: string; emptyHint?: string; actions?: (r: T) => ReactNode;
}) {
  if (!rows.length) return <Empty title={empty} hint={emptyHint} />;
  const primary = cols.find((c) => c.primary) ?? cols[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-brand-soft/60 text-muted">
            <tr>{cols.map((c) => <th key={c.key} className="px-4 py-2.5 font-medium">{c.header}</th>)}{actions && <th className="px-4 py-2.5" />}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line/70 last:border-0 hover:bg-paper">
                {cols.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>{c.cell(r)}</td>)}
                {actions && <td className="px-4 py-2 text-right"><div className="flex justify-end gap-1.5">{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-card border border-line bg-surface p-4">
            <div className="mb-2 font-medium">{primary.cell(r)}</div>
            <dl className="space-y-1.5 text-sm">
              {cols.filter((c) => c !== primary).map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3"><dt className="text-muted">{c.header}</dt><dd className="text-right">{c.cell(r)}</dd></div>
              ))}
            </dl>
            {actions && <div className="mt-3 flex flex-wrap justify-end gap-2">{actions(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
