import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { resolveIdentity } from "../_shared/identity.ts";
import { z, parseBody, email as emailField } from "../_shared/validate.ts";

/**
 * Lightweight email-availability check for the student profile / invite UIs.
 *
 * A team member is warned BEFORE submitting when the email already belongs to
 * any account, so they pick a different address instead of triggering a
 * dead activation link that accept-invitation will later reject.
 *
 * Mirrors the auth pattern of create-student-standalone: only an authenticated
 * admin/team_member may call it. Returns only the minimal fields the UI needs to
 * render a friendly conflict message — never any other profile data.
 *
 * NOTE: a *pending* invitation (no auth account yet) is NOT a "taken" email —
 * resolveIdentity looks up profiles/auth.users, not user_invitations — so a resend
 * to a never-activated invitee still succeeds.
 */
function jsonResponse(payload: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error", code: "SERVER_CONFIGURATION_ERROR" }, 500, corsHeaders);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Validate caller ────────────────────────────────────────────────
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid token", code: "INVALID_TOKEN" }, 401, corsHeaders);
    }
    const callerId = userData.user.id;

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "team_member"]);

    if (rolesError) {
      return jsonResponse({ error: "Unable to verify access", code: "ROLE_LOOKUP_FAILED" }, 500, corsHeaders);
    }
    if (!roles?.length) {
      return jsonResponse({ error: "Team member access required", code: "FORBIDDEN" }, 403, corsHeaders);
    }

    // ── Parse + validate email ─────────────────────────────────────────
    const parsed = await parseBody(req, z.object({ email: emailField }));
    if (!parsed.ok) {
      return jsonResponse({ error: parsed.error, code: "INVALID_INPUT" }, 400, corsHeaders);
    }
    const email = parsed.data.email.trim().toLowerCase();

    // ── Resolve identity (profiles + auth.users) ───────────────────────
    const identity = await resolveIdentity(supabaseAdmin, email);

    return jsonResponse(
      {
        available: !identity.exists,
        existing_role: identity.exists ? identity.role : null,
        deactivated: identity.exists ? identity.deactivated : false,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error("check-email-availability: unhandled error", error);
    return jsonResponse({ error: "Server error", code: "server_error" }, 500, corsHeaders);
  }
});
