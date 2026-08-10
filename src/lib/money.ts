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

/**
 * Formats an amount in whatever currency the row carries: ILS goes through
 * {@link formatILS} so the shekel presentation stays identical everywhere, any
 * other currency (school invoices in EUR, …) falls back to `Intl`.
 */
export function formatCurrencyAmount(amount: number | null | undefined, currency: string): string {
  if (currency === CURRENCY) return formatILS(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
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
