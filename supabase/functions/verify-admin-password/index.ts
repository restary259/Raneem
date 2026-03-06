// supabase/functions/verify-admin-password/index.ts
// ─────────────────────────────────────────────────────────────────────────
// Verifies the currently logged-in admin's password and returns a
// short-lived signed view token (2 min TTL, single-use via Supabase KV).
//
// This is used as a password gate before viewing sensitive student
// profile data in AdminStudentsPage.
//
// POST /functions/v1/verify-admin-password
// Body: { password: string }
// Response 200: { view_token: string, expires_in: 120 }
// Response 401: { error: "Wrong password" }
// ─────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate caller token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Invalid token" }, 401);
    }

    const callerId = userData.user.id;
    const callerEmail = userData.user.email;

    // Verify the caller is an admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin");

    if (!roles?.length) {
      return json({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return json({ error: "Password is required" }, 400);
    }

    // Verify the password by attempting to sign in with the admin's email
    // This is 100% server-side — the password never touches application state
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: signInData, error: signInError } =
      await supabaseAuth.auth.signInWithPassword({
        email: callerEmail!,
        password,
      });

    if (signInError || !signInData?.user) {
      // Log the failed attempt — non-fatal, correct column names
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: callerId,
        action: "admin_password_verify_failed",
        target_table: "profiles",
        target_id: callerId,
        details: JSON.stringify({ ip: req.headers.get("x-forwarded-for") ?? "unknown" }),
      }).catch((e: unknown) => console.warn("audit log warn:", e));

      return json({ error: "Wrong password" }, 401);
    }

    // Sign out the temporary session immediately — we only needed verification
    await supabaseAuth.auth.signOut().catch(() => {});

    // Generate a signed view token
    const viewToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 120_000).toISOString(); // 2 minutes

    // ── Non-fatal audit log (correct column names: target_table, details) ──
    // admin_audit_log schema: admin_id, action, target_table (text), target_id (text), details (text)
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: callerId,
      action: "view_token_issued",
      target_table: "profiles",
      target_id: callerId,
      details: JSON.stringify({ view_token: viewToken, expires_at: expiresAt }),
    }).catch((e: unknown) => console.warn("audit log warn:", e));

    // Log the successful verification
    await supabaseAdmin.rpc("log_activity", {
      p_actor_id: callerId,
      p_actor_name: callerEmail ?? "Admin",
      p_action: "admin_password_verified",
      p_entity_type: "admin",
      p_entity_id: callerId,
      p_metadata: { view_token_issued: true },
    }).catch(() => {});

    return json({ view_token: viewToken, expires_in: 120 }, 200);
  } catch (e) {
    console.error("verify-admin-password error:", e);
    return json({ error: "Server error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
