'use client';
import { useParams } from 'next/navigation';
import { Hourglass } from 'lucide-react';
import { useT } from '@/i18n';
import { MESS_FEATURES, PLANNED_NOTES } from '@/lib/features';
import { Card, PageHeader } from '@/components/ui';

/** One page serves every 'planned' feature in the registry (no backend routes yet). */
export default function ComingSoon() {
  const { feature } = useParams<{ feature: string }>();
  const { t } = useT();
  const f = MESS_FEATURES.find((x) => x.id === feature && x.status === 'planned');
  return (
    <>
      <PageHeader title={f ? t(f.labelKey) : t('common.soon')} />
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <Hourglass className="h-8 w-8 text-holud" aria-hidden />
        <p className="font-medium">{t('soon.title')}</p>
        <p className="max-w-md text-sm text-muted">{t('soon.body')}</p>
        {f && PLANNED_NOTES[f.id] && <p className="max-w-md text-xs text-muted/80">{t(`soon.${f.id}`)}</p>}
      </Card>
    </>
  );
}
