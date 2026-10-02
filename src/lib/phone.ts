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

// ---------------------------------------------------------------------------
// Country-neutral helpers.
//
// `normalizePhone` above is Israel-defaulting because the WhatsApp audience is
// Israeli. Office display/tel links are not: DARB offices span countries, so a
// national leading zero must never be assumed to mean Israel. These helpers
// only apply a country code when the country is actually known.
// ---------------------------------------------------------------------------

const DIAL_CODES: Record<string, string> = {
  IL: "972",
  DE: "49",
  AT: "43",
  CH: "41",
  GB: "44",
  US: "1",
  TR: "90",
  JO: "962",
  PS: "970",
  AE: "971",
};

function dialCode(country?: string | null): string | undefined {
  if (!country) return undefined;
  return DIAL_CODES[country.trim().toUpperCase()];
}

/** E.164 when the country is known or the input is already international; otherwise the digits as-is. */
export function toE164(phone: string | null | undefined, country?: string | null): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) {
    const code = dialCode(country);
    return code ? `+${code}${digits.replace(/^0+/, "")}` : digits;
  }
  return `+${digits}`;
}

/** `tel:` href for an office phone number. Empty string when there is no number. */
export function telHref(phone: string | null | undefined, country?: string | null): string {
  const e164 = toE164(phone, country);
  return e164 ? `tel:${e164}` : "";
}

/** Display form: keep author formatting for international input, otherwise normalize. */
export function formatPhoneDisplay(phone: string | null | undefined, country?: string | null): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  return toE164(raw, country);
}
