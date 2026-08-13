/**
 * Referral discount derivation (single source of truth).
 *
 * The legacy `referrals.discount_applied` boolean was never flipped to true by
 * any code path, so the Admin Referrals "Discount" column always showed "No"
 * even when the friend's case did receive the discount. The authoritative
 * signal that a discount was applied is the linked case's `referral_discount`
 * column being greater than zero — it is snapshotted at case creation and is
 * the same value the finance functions subtract. Deriving from the case avoids
 * a second stored state that can drift from the real financials.
 */

/** True when the linked case carries a positive referral discount. */
export function discountAppliedFromCase(
  referralDiscount: number | string | null | undefined,
): boolean {
  const n = Number(referralDiscount);
  return Number.isFinite(n) && n > 0;
}
