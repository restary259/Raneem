import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimited(bucket: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = memory.get(bucket);
  if (!entry || now > entry.resetAt) {
    memory.set(bucket, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

/**
 * Durable rate limit shared across instances (public.check_rate_limit).
 * Falls back to the per-instance memory counter if the RPC is unavailable,
 * so behaviour never gets looser than before.
 */
export async function isRateLimited(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const local = memoryLimited(bucket, max, windowSeconds * 1000);
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return local;
    return data === true || local;
  } catch {
    return local;
  }
}
