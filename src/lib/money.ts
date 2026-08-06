/**
 * All money in Darb is shekels (ILS). There is no multi-currency money logic.
 * Every amount displayed anywhere in the dashboards must go through here so the
 * symbol, digits and grouping are identical in Arabic (RTL) and English.
 */

export const CURRENCY = 'ILS' as const;
export const CURRENCY_SYMBOL = '₪';

/** `₪ 12,500` — always ASCII digits, symbol first, works in RTL. */
export function formatILS(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${CURRENCY_SYMBOL} ${Math.round(safe).toLocaleString('en-US')}`;
}

/** `₪ 12,500.50` — for values that can carry agorot. */
export function formatILSPrecise(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${CURRENCY_SYMBOL} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
