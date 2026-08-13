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

export interface DarbInvoiceSchoolLine {
  kind: string;
  name_ar: string | null;
  name_en: string | null;
  weekly_price: number | null;
  weeks: number | null;
  total: number;
  currency: string;
  estimate?: boolean;
}

export interface DarbInvoiceTotals {
  currency: "ILS";
  services: DarbInvoiceServiceLine[];
  /** Sum of unit_price × quantity before discounts (ILS). */
  subtotal: number;
  /** Sum of the per-line discounts (ILS), never negative. */
  discount_total: number;
  /** Referral discount applied to the case (₪), already netted out of service_total. */
  referral_discount: number;
  service_total: number;
  /** Confirmed agency-service payments only (ILS). */
  total_confirmed: number;
  /** Outstanding agency-service balance (ILS), never negative. */
  remaining: number;
  /** Germany school/accommodation/insurance estimates — separate currency. */
  school_costs: DarbInvoiceSchoolLine[];
  payment_type: "agency_service";
}

/** Anything the DB might return for a totals snapshot (jsonb → unknown). */
export type RawInvoiceTotals = Partial<DarbInvoiceTotals> & Record<string, unknown>;

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Normalizes a raw totals snapshot into the shape every renderer relies on.
 *
 * - `subtotal` / `discount_total` are derived from the frozen service lines,
 *   so they always reconcile with `service_total` (subtotal − discounts).
 * - `total_confirmed` comes from the snapshot when present; legacy snapshots
 *   that predate the fix have no payment data to derive it from, so they fall
 *   back to 0 (nothing shown as confirmed).
 * - `remaining` is always `max(service_total - total_confirmed, 0)` — computed
 *   here, never copy-pasted at call sites.
 */
export function selectInvoiceTotals(raw: unknown): DarbInvoiceTotals {
  const data = (raw && typeof raw === "object" ? raw : {}) as RawInvoiceTotals;

  const services = Array.isArray(data.services)
    ? (data.services as DarbInvoiceServiceLine[])
    : [];

  const subtotal = round2(
    services.reduce(
      (sum, s) => sum + toFiniteNumber(s.unit_price, 0) * toFiniteNumber(s.quantity, 0),
      0,
    ),
  );
  const discount_total = round2(
    Math.max(
      services.reduce((sum, s) => sum + toFiniteNumber(s.discount, 0), 0),
      0,
    ),
  );

  const service_total = toFiniteNumber(data.service_total, round2(subtotal - discount_total));
  const referral_discount = Math.max(toFiniteNumber(data.referral_discount, 0), 0);
  const total_confirmed = toFiniteNumber(data.total_confirmed, 0);

  const school_costs = Array.isArray(data.school_costs)
    ? (data.school_costs as DarbInvoiceSchoolLine[]).filter(
        (l) => toFiniteNumber(l?.total, 0) > 0,
      )
    : [];

  return {
    currency: "ILS",
    services,
    subtotal,
    discount_total,
    referral_discount,
    service_total,
    total_confirmed,
    remaining: Math.max(round2(service_total - total_confirmed), 0),
    school_costs,
    payment_type: "agency_service",
  };
}

