import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({ password: z.string().min(1).max(256) }).strict();

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed", code: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Authentication required", code: "invalid_session" }, 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return json({ error: "Authentication required", code: "invalid_session" }, 401);

  let input: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors, code: "validation_failed" }, 400);
    }
    input = parsed.data;
  } catch {
    return json({ error: "Invalid JSON body", code: "validation_failed" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "Server configuration error", code: "server_configuration" }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) {
    return json({ error: "Invalid or expired session", code: "invalid_session" }, 401);
  }

  // Preserve native Auth password policy and session/AAL enforcement. Identity
  // comes only from the verified bearer token; no target user id is accepted.
  const authResponse = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: input.password }),
  });

  let authBody: { message?: string; error?: string; error_code?: string; code?: string } = {};
  try {
    authBody = await authResponse.json();
  } catch {
    // Never log passwords or raw upstream response bodies.
  }

  const authCode = authBody.error_code ?? authBody.code;
  const authMessage = authBody.message ?? authBody.error ?? "Password update failed";
  const samePassword = authCode === "same_password" || /same[_ ]password|different from the old/i.test(authMessage);
  if (!authResponse.ok && !samePassword) {
    const status = authResponse.status >= 400 && authResponse.status < 500 ? authResponse.status : 500;
    return json({ error: authMessage, code: authCode ?? "auth_update_failed" }, status);
  }

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", caller.user.id);
  if (flagError) {
    console.error("change-own-password flag persistence failed", { userId: caller.user.id, code: flagError.code });
    return json({ error: "Password changed, but account state could not be finalized", code: "flag_persistence_failed" }, 500);
  }

  const { data: profile, error: verifyError } = await admin
    .from("profiles")
    .select("must_change_password")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (verifyError || profile?.must_change_password !== false) {
    console.error("change-own-password flag verification failed", { userId: caller.user.id, code: verifyError?.code });
    return json({ error: "Password changed, but account state could not be verified", code: "flag_verification_failed" }, 500);
  }

  return json({ success: true }, 200);
});