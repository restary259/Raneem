import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a set of profile ids to a `{ id -> full_name }` map. Returns an empty
 * map (never throws) so callers can destructure safely into a fallback label.
 *
 * Shared by the Documents library list and the editor's load() so they build
 * the same name map without duplicating the `profiles` SELECT + null-guards.
 */
export async function resolveProfileNames(
  ids: Iterable<string>,
): Promise<Record<string, string>> {
  const uids = Array.from(new Set([...ids].filter(Boolean)));
  if (uids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uids);
  if (error) {
    console.warn("[Darb] resolveProfileNames failed:", error.message);
    return {};
  }
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row?.id) map[row.id] = row.full_name ?? "";
  }
  return map;
}

export default resolveProfileNames;
