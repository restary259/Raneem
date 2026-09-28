/** Presentation-only helpers shared by the WhatsApp workspace pieces. */

export const fmt = (value: string, lang: string) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const fmtDay = (value: string, lang: string) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-IL" : "en-GB", { dateStyle: "full" }).format(new Date(value));

/** Avatar fallback: initials, or the last two digits of a phone number. */
export function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "#";
  if (/^\+?\d/.test(parts[0])) return parts[0].replace(/\D/g, "").slice(-2);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Outbound delivery tick. Colour alone never carries the state. */
export function deliveryMark(status: string | null | undefined): string {
  switch (status) {
    case "read": return "✓✓";
    case "delivered": return "✓✓";
    case "sent": case "accepted": return "✓";
    case "failed": return "⚠";
    default: return "…";
  }
}
