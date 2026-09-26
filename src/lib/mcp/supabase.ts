import { createClient } from "@supabase/supabase-js";
import type { AuthContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: readonly string[]): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  for (const n of names) {
    const v = runtime.process?.env?.[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function projectUrl(): string {
  const url = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
}

function publishableKey(): string {
  const key =
    env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Supabase publishable key is required");
  return key;
}

/** Forwards the verified bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: AuthContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("A verified sign-in is required");
  return createClient(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
