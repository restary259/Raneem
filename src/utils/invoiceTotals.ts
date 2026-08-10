/**
 * Single source of truth for the DARB invoice totals shown on the public
 * invoice page and the invoice PDF.
 *
 * The snapshot stored in `case_invoices.totals` is produced server-side by
 * `issue_case_invoice` and read back through `get_invoice_by_token`. It carries
 * `total_confirmed` / `remaining` since migration 20260810170000, but older
 * invoices still only have `service_total`. Both renderers must go through
 * {@link selectInvoiceTotals} so the paid/remaining derivation (and the legacy
 * fallback) lives in exactly one place and can never disagree.
 */

export interface DarbInvoiceServiceLine {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit_price: number;
  discount: number;
  currency: string;
  line_total: number;
}

export interface DarbInvoiceTotals {
  currency: "ILS";
  services: DarbInvoiceServiceLine[];
  service_total: number;
  /** Confirmed agency-service payments only (ILS). */
  total_confirmed: number;
  /** Outstanding agency-service balance (ILS), never negative. */
  remaining: number;
  payment_type: "agency_service";
}

/** Anything the DB might return for a totals snapshot (jsonb → unknown). */
export type RawInvoiceTotals = Partial<DarbInvoiceTotals> & Record<string, unknown>;

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Normalizes a raw totals snapshot into the shape every renderer relies on.
 *
 * - `total_confirmed` comes from the snapshot when present; legacy snapshots
 *   that predate the fix have no payment data to derive it from, so they fall
 *   back to 0 (nothing shown as confirmed).
 * - `remaining` is always `max(service_total - total_confirmed, 0)` — computed
 *   here, never copy-pasted at call sites.
 */
export function selectInvoiceTotals(raw: unknown): DarbInvoiceTotals {
  const data = (raw && typeof raw === "object" ? raw : {}) as RawInvoiceTotals;

  const service_total = toFiniteNumber(data.service_total, 0);
  const total_confirmed = toFiniteNumber(data.total_confirmed, 0);

  return {
    currency: "ILS",
    services: Array.isArray(data.services)
      ? (data.services as DarbInvoiceServiceLine[])
      : [],
    service_total,
    total_confirmed,
    remaining: Math.max(service_total - total_confirmed, 0),
    payment_type: "agency_service",
  };
}
