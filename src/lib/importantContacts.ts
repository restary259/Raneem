/**
 * Context-aware Important Contacts — matching predicate.
 *
 * The AUTHORITATIVE filter for which contacts a student may see is the
 * SECURITY DEFINER Postgres RPC `get_student_important_contacts()` in
 * `supabase/migrations/20260813120000_context_aware_important_contacts.sql`.
 * Students never read `important_contacts` directly (RLS blocks them), so the
 * RPC is the only path and the frontend cannot leak contacts.
 *
 * This pure TypeScript predicate mirrors the SAME rules the RPC enforces, so
 * the matching logic is unit-testable without a database and reusable by the
 * admin preview. If you change targeting behaviour, update BOTH this function
 * and the SQL RPC together.
 */

export type ContactScope =
  | "universal"
  | "school_city"
  | "school_only"
  | "city_only";

export interface ImportantContact {
  id: string;
  scope: ContactScope;
  is_universal: boolean;
  is_active: boolean;
  language_school_id: string | null;
  /** Free-text targeting city (matches the student's resolved city). */
  city: string | null;
}

export interface StudentContext {
  /** The student's active language-school id (from case_submissions.school_id). */
  schoolId: string | null;
  /** The student's resolved city (school's city, falling back to case.city). */
  city: string | null;
}

/** Tag used to group contacts in the student UI (matches the RPC's column). */
export type MatchScope = "universal" | "school" | "city" | "school_city";

const norm = (v: string | null | undefined): string =>
  (v ?? "").trim().toLowerCase();

/**
 * Decide whether `contact` is visible to a student with `ctx`, and if so under
 * which group. Returns `null` when the contact does not apply.
 *
 * Inactive contacts never match. Universal contacts always match. School-only
 * contacts match by school id. City-only contacts match by city. School+city
 * contacts require both. A single contact can only satisfy one scope (its own),
 * so a contact can never appear twice — dedup is implicit by id.
 */
export function matchContact(
  contact: ImportantContact,
  ctx: StudentContext,
): MatchScope | null {
  if (!contact.is_active) return null;

  switch (contact.scope) {
    case "universal":
      return "universal";

    case "school_only":
      if (contact.language_school_id && contact.language_school_id === ctx.schoolId) {
        return "school";
      }
      return null;

    case "city_only": {
      const c = norm(contact.city);
      if (!c) return null;
      return c === norm(ctx.city) ? "city" : null;
    }

    case "school_city": {
      const c = norm(contact.city);
      if (!contact.language_school_id || !c) return null;
      if (
        contact.language_school_id === ctx.schoolId &&
        c === norm(ctx.city)
      ) {
        return "school_city";
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Apply the predicate to a list and return contacts grouped by their match
 * scope, deduplicated by id. Stable order is preserved (input order wins).
 */
export function filterContactsByContext<T extends ImportantContact>(
  contacts: T[],
  ctx: StudentContext,
): { scope: MatchScope; contacts: T[] }[] {
  const seen = new Set<string>();
  const buckets: Record<MatchScope, T[]> = {
    universal: [],
    school: [],
    city: [],
    school_city: [],
  };
  for (const contact of contacts) {
    if (seen.has(contact.id)) continue; // safety: dedup by id
    const scope = matchContact(contact, ctx);
    if (!scope) continue;
    seen.add(contact.id);
    buckets[scope].push(contact);
  }
  const groups: { scope: MatchScope; contacts: T[] }[] = [];
  (["universal", "school_city", "school", "city"] as MatchScope[]).forEach((s) => {
    if (buckets[s].length) groups.push({ scope: s, contacts: buckets[s] });
  });
  return groups;
}
