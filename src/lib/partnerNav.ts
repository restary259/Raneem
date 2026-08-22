/**
 * Single predicate for the partner/ambassador/agent Apply-nav gating shared
 * by the sidebar and the mobile "More" sheet. The `nav.apply` entry is
 * removed only for apply-gated roles whose admin toggle
 * (profiles.apply_form_enabled) is off; every other role keeps its nav
 * untouched.
 */
export function filterApplyNavItem<T extends { key: string }>(
  items: T[],
  isPartnerRole: boolean,
  applyFormEnabled: boolean,
): T[] {
  if (!isPartnerRole || applyFormEnabled) return items;
  return items.filter((item) => item.key !== "nav.apply");
}
