/**
 * Phone helpers shared by every flow that stores or links to a case phone number.
 * Israeli numbers are the default audience, so local `05X…` input is normalised
 * to the international `972…` form used by WhatsApp deep links.
 */

/** Digits-only international number (no `+`), suitable for wa.me links. */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("00972")) return digits.slice(2);
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

/** True when the number can produce a usable WhatsApp / tel link. */
export function isLinkablePhone(phone: string | null | undefined): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 9 && digits.length <= 15;
}

/** wa.me URL, or null when the stored number is missing/malformed. */
export function whatsappUrl(phone: string | null | undefined): string | null {
  if (!isLinkablePhone(phone)) return null;
  return `https://wa.me/${normalizePhone(phone)}`;
}
