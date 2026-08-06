/** Reusable Excel number / date formats for every Darb export. */

export type ExportColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'status';

/** Darb money is shekels only — there is no multi-currency money logic. */
export type CurrencyCode = 'ILS';

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  ILS: '₪',
};

/** Accounting-style currency: negatives in red parentheses, zero as an em dash. */
export function currencyFormat(currency: CurrencyCode = 'ILS'): string {
  const s = CURRENCY_SYMBOL[currency] ?? CURRENCY_SYMBOL.ILS;
  return `"${s}"#,##0.00;[Red]("${s}"#,##0.00);"—"`;
}

export const NUMBER_FORMAT = '#,##0;[Red](#,##0);"—"';
/** Percent values are stored on a 0-100 scale across the app, not 0-1. */
export const PERCENT_FORMAT = '0.0"%"';
export const DATE_FORMAT = 'dd/MM/yyyy';
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

export function numFmtFor(type: ExportColumnType | undefined, currency?: CurrencyCode): string | undefined {
  switch (type) {
    case 'currency':
      return currencyFormat(currency);
    case 'number':
      return NUMBER_FORMAT;
    case 'percent':
      return PERCENT_FORMAT;
    case 'date':
      return DATE_FORMAT;
    case 'datetime':
      return DATETIME_FORMAT;
    default:
      return undefined;
  }
}

export function alignmentFor(type: ExportColumnType | undefined): 'left' | 'right' | 'center' {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'date':
    case 'datetime':
      return 'right';
    case 'status':
      return 'center';
    default:
      return 'left';
  }
}

/** Coerce a raw value into something Excel can format natively. */
export function coerceValue(value: unknown, type: ExportColumnType | undefined): string | number | Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (type === 'date' || type === 'datetime') {
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d;
  }

  if (type === 'number' || type === 'currency' || type === 'percent') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && cleaned !== '' ? n : String(value);
  }

  if (value instanceof Date) return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value;
  return String(value);
}

/** Timestamp shown in the report header, always in Jerusalem time. */
export function generatedStamp(locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'en-US' : locale, {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
