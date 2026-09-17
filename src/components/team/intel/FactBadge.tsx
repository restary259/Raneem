import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { VerificationStatus, FactType, VerifiedFact } from '@/data/intel/factTypes';
import { withFreshness } from '@/data/intel/factTypes';
import type { CheckStatus } from '@/lib/eligibility/engine';

const STATUS_CLASS: Record<VerificationStatus, string> = {
  verified: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  stale: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  conflicting: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  unverified: 'bg-muted text-muted-foreground border-border',
};

export function VerificationBadge({
  status,
  checkedAt,
  className,
}: {
  status: VerificationStatus;
  checkedAt?: string | null;
  className?: string;
}) {
  const { t } = useTranslation('dashboard');
  const label = t(`intel.status.${status}`, status);
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', STATUS_CLASS[status], className)}>
      {label}
      {checkedAt && status !== 'unverified' && (
        <span className="opacity-70">· {new Date(checkedAt).toLocaleDateString('en-US')}</span>
      )}
    </Badge>
  );
}

const CHECK_CLASS: Record<CheckStatus, string> = {
  MEETS: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  DOES_NOT_MEET: 'bg-destructive/10 text-destructive border-destructive/30',
  NOT_DETERMINABLE: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

export function CheckBadge({ status }: { status: CheckStatus }) {
  const { t } = useTranslation('dashboard');
  return (
    <Badge variant="outline" className={cn('font-medium', CHECK_CLASS[status])}>
      {t(`intel.check.${status}`, status)}
    </Badge>
  );
}

const FACT_TYPE_CLASS: Partial<Record<FactType, string>> = {
  CALCULATED_VALUE: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30',
  DARB_OPERATIONAL_GUIDANCE: 'bg-brand/10 text-brand border-brand/30',
};

export function FactTypeBadge({ factType }: { factType: FactType }) {
  const { t } = useTranslation('dashboard');
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', FACT_TYPE_CLASS[factType] ?? 'border-border text-muted-foreground')}
    >
      {t(`intel.factType.${factType}`, factType)}
    </Badge>
  );
}

/** Renders a fact's value with its own badge, note and source link. */
export function FactLine({
  label,
  f,
  render,
  sourceUrl,
}: {
  label: string;
  f: VerifiedFact<unknown>;
  render?: (value: unknown) => React.ReactNode;
  sourceUrl?: string;
}) {
  const { t, i18n } = useTranslation('dashboard');
  const fresh = withFreshness(f);
  const isAr = i18n.language === 'ar';
  const note = isAr ? (fresh.noteAR ?? fresh.note) : fresh.note;

  return (
    <div className="space-y-1 border-b border-border/50 py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <VerificationBadge status={fresh.status} checkedAt={fresh.checkedAt} />
        <FactTypeBadge factType={fresh.factType} />
      </div>
      {fresh.value !== null ? (
        <div className="text-sm text-foreground">
          {render ? render(fresh.value) : String(fresh.value)}
        </div>
      ) : (
        <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {fresh.status === 'conflicting'
            ? t('intel.conflictTitle', 'Official sources disagree — do not give a definitive answer')
            : t('intel.noOfficialFact', 'No official requirement found — do not assume one')}
        </div>
      )}
      {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-brand underline underline-offset-2"
        >
          {t('intel.openSource', 'Open source')}
        </a>
      )}
    </div>
  );
}
