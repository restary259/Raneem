import { SUPPORT_PHONE } from "@/lib/contactConfig";

/**
 * Canonical on-site description of DARB's physical office, shared by the
 * Organization / LocalBusiness structured data so crawler-visible local-entity
 * data (address, country, hours) can never drift from the contact UI.
 *
 * Mirrors the `tamra` row seeded in `supabase/migrations/20260927141500_*` and
 * the map query in `src/components/landing/Map.tsx`.
 */
export const DARB_OFFICE = {
  nameAr: "مكتب درب · طمرة",
  nameEn: "DARB Office · Tamra",
  streetAddress: "Tamra Mall",
  addressLocality: "Tamra",
  postalCode: "3081100",
  addressCountry: "IL",
  telephone: SUPPORT_PHONE,
  /** Sunday–Thursday, matching the seeded `office_hours` (weekday 0–4). */
  openingHours: {
    daysOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "10:00",
    closes: "17:00",
  },
} as const;
