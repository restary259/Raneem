import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Human-readable labels for raw database values shown in the Spreadsheet Hub.
 * Unknown values fall back to the raw string so a cell is never blank.
 */
export type SheetEnumGroup =
  | 'status'
  | 'rewardStatus'
  | 'kind'
  | 'role'
  | 'method'
  | 'bool'
  | 'programType'
  | 'month';

export type TranslateFn = (key: string, fallback?: string) => string;

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/** Strip trailing UUIDs from generated note strings, e.g. "…from case 3f2b…" */
export const cleanNote = (value: string): string =>
  value.replace(/\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*/gi, ' ').trim();

export const translateSheetValue = (
  t: TranslateFn,
  group: SheetEnumGroup,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === '') return '—';

  if (group === 'month') {
    const raw = String(value);
    const m = /^(\d{4})-(\d{2})/.exec(raw);
    if (!m) return raw;
    const idx = Number(m[2]) - 1;
    if (idx < 0 || idx > 11) return raw;
    return `${t(`sheets.value.month.${MONTH_KEYS[idx]}`, MONTH_KEYS[idx])} ${m[1]}`;
  }

  if (group === 'bool') {
    const truthy = value === true || value === 'yes' || value === 'true' || value === 1;
    return truthy ? t('sheets.value.bool.yes', 'Active') : t('sheets.value.bool.no', 'Inactive');
  }

  const raw = String(value);

  // Generated commission notes: "Team commission from case <uuid>"
  if (group === 'kind' || group === 'status') {
    if (/^team commission/i.test(raw)) return t('sheets.value.kind.team', 'Team commission');
    if (/^partner commission/i.test(raw)) return t('sheets.value.kind.partner', 'Partner commission');
  }

  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');

  // For case statuses, prefer the canonical case.status.* namespace so the
  // spreadsheet matches the case detail page and analytics exactly.
  if (group === 'status') {
    const caseLabel = t(`case.status.${normalized}`, '');
    if (caseLabel && caseLabel !== `case.status.${normalized}`) return caseLabel;
  }

  const translated = t(`sheets.value.${group}.${normalized}`, '');
  if (translated && translated !== `sheets.value.${group}.${normalized}`) return translated;

  // Fall back to a readable version of the raw value.
  return cleanNote(raw);
};

export const useSheetLabels = () => {
  const { t } = useTranslation('dashboard');
  const translate = useCallback(
    (group: SheetEnumGroup, value: unknown) =>
      translateSheetValue((key, fallback) => t(key, fallback ?? '') as string, group, value),
    [t],
  );
  return { translate };
};
