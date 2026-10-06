/**
 * Students-tab scoping — the single source of truth for which student
 * accounts a staff member sees.
 *
 *  - Admin: every account holding the student role.
 *  - Team member: ONLY students they created (manual or invite →
 *    profiles.created_by = me) plus students whose case is assigned to them.
 *
 * Filters are explicit here, never left to RLS alone, so a future widening of
 * a profiles policy cannot leak other members' students into this list.
 * Read failures throw — never laundered into an empty list.
 *
 * DB parity rule: team visibility of a student must be granted by
 * `cases.assigned_to = me` OR `profiles.created_by = me` on every related
 * table (profiles, user_roles via team_can_view_student_role, documents).
 * Unassigning a case must never hide a student from the member who created them.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ScopedStudent {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

const COLS = "id, full_name, email, created_at";

export async function listScopedStudents(
  { userId, isAdmin }: { userId: string; isAdmin: boolean },
  client: any = supabase,
): Promise<ScopedStudent[]> {
  if (isAdmin) {
    const { data: roleRows, error: roleErr } = await client
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");
    if (roleErr) throw roleErr;
    const studentIds = [...new Set<string>((roleRows ?? []).map((r: any) => r.user_id))];
    if (studentIds.length === 0) return [];
    const { data, error } = await client
      .from("profiles")
      .select(COLS)
      .in("id", studentIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  // Team member: collect candidates FIRST (created by me + assigned to me),
  // then confirm the student role only for those ids. Never start from an
  // unscoped user_roles read — an empty RLS result there used to hide every
  // student the member created (e.g. after their case was unassigned).
  const { data: created, error: createdErr } = await client
    .from("profiles")
    .select(COLS)
    .eq("created_by", userId);
  if (createdErr) throw createdErr;

  const { data: caseRows, error: caseErr } = await client
    .from("cases")
    .select("student_user_id")
    .eq("assigned_to", userId)
    .is("deleted_at", null)
    .not("student_user_id", "is", null);
  if (caseErr) throw caseErr;

  const known = new Set<string>((created ?? []).map((p: any) => p.id));
  const assignedIds = [...new Set<string>((caseRows ?? []).map((c: any) => c.student_user_id))].filter(
    (id) => !known.has(id),
  );
  let assigned: ScopedStudent[] = [];
  if (assignedIds.length > 0) {
    const { data, error } = await client.from("profiles").select(COLS).in("id", assignedIds);
    if (error) throw error;
    assigned = data ?? [];
  }

  const candidates = [...(created ?? []), ...assigned];
  if (candidates.length === 0) return [];

  const { data: roleRows, error: roleErr } = await client
    .from("user_roles")
    .select("user_id")
    .eq("role", "student")
    .in("user_id", candidates.map((p) => p.id));
  if (roleErr) throw roleErr;
  const studentIds = new Set<string>((roleRows ?? []).map((r: any) => r.user_id));

  return candidates
    .filter((p) => studentIds.has(p.id))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** Server rule mirrored by create-student-standalone: only admins may file a student under someone else. */
export function resolveCreatedBy(isAdmin: boolean, callerId: string, requested?: string | null): string {
  return isAdmin && requested ? requested : callerId;
}
