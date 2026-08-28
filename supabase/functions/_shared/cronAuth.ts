import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Recognises the database cron dispatcher.
 *
 * pg_cron cannot present a user JWT and the service-role key is not stored in
 * the vault, so the scheduled dispatchers send a dedicated random secret
 * (`cron_dispatch_secret`, minted in the vault). The secret is only readable
 * through `get_cron_dispatch_secret()`, which is granted to `service_role`
 * alone, so it can never be obtained from the client.
 *
 * Returns true only when the caller presents that exact secret as its bearer
 * token. Every other caller falls through to the function's normal auth check.
 */
export async function isCronDispatcher(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.length < 32) return false;

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data, error } = await admin.rpc("get_cron_dispatch_secret");
    if (error || typeof data !== "string" || data.length < 32) return false;
    return timingSafeEqual(token, data);
  } catch (_) {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
