import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthResult =
  | { ok: true; userId: string | null; isServiceRole: boolean; roles: string[] }
  | { ok: false; status: number; error: string };

/**
 * Verifies the caller of an edge function.
 *
 * Accepts either:
 *  - the service-role key (internal / trigger / cron callers), or
 *  - a valid user JWT, optionally restricted to a set of roles from user_roles.
 */
export async function requireAuth(
  req: Request,
  allowedRoles?: string[],
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) {
    return { ok: true, userId: null, isServiceRole: true, roles: [] };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);

  if (allowedRoles && !roles.some((r) => allowedRoles.includes(r))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId: data.user.id, isServiceRole: false, roles };
}
