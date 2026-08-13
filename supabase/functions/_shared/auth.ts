import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthResult =
  | { ok: true; userId: string | null; isServiceRole: boolean; roles: string[] }
  | { ok: false; status: number; error: string };

/** Fire-and-forget record of a 401/403 denial for admin monitoring. */
async function logDenial(
  req: Request,
  status: number,
  message: string,
  userId: string | null,
) {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const target = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "unknown";
    await admin.from("auth_failure_log").insert({
      user_id: userId,
      is_anonymous: !userId,
      source: "edge_function",
      target,
      operation: req.method,
      status_code: String(status),
      error_message: message,
      path: new URL(req.url).pathname,
    });
  } catch (_) {
    // Monitoring must never block the response.
  }
}
/**
 * True when `token` is a genuine service-role credential for this project:
 * it must carry the `service_role` claim (or be an opaque secret key) and be
 * accepted by the admin API, which only the service role may call.
 */
async function isWorkingServiceRoleToken(token: string): Promise<boolean> {
  const looksLikeSecret = token.startsWith("sb_secret_");
  if (!looksLikeSecret) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
      if (payload?.role !== "service_role") return false;
    } catch (_) {
      return false;
    }
  }
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", token);
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  } catch (_) {
    return false;
  }
}


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
    await logDenial(req, 401, "Missing bearer token", null);
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    await logDenial(req, 401, "Empty bearer token", null);
    return { ok: false, status: 401, error: "Unauthorized" };
  }


  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) {
    return { ok: true, userId: null, isServiceRole: true, roles: [] };
  }

  // The env-bound service key can rotate (legacy JWT vs. new secret key), so a
  // strict string match is not enough for internal function-to-function calls.
  // Accept any token that carries the service_role claim AND actually works as
  // a service-role credential against the admin API.
  if (await isWorkingServiceRoleToken(token)) {
    return { ok: true, userId: null, isServiceRole: true, roles: [] };
  }


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    await logDenial(req, 401, "Invalid or expired token", null);
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
    await logDenial(
      req,
      403,
      `Role not allowed (has: ${roles.join(",") || "none"})`,
      data.user.id,
    );
    return { ok: false, status: 403, error: "Forbidden" };
  }


  return { ok: true, userId: data.user.id, isServiceRole: false, roles };
}
