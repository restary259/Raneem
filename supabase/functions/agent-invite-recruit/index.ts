import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverError } from "../_shared/errors.ts";
import { z, parseBody, email as emailField, personName } from "../_shared/validate.ts";
import { createInvitation, InvitationConflictError, InvitationType } from "../_shared/invitations.ts";
import { identityConflict } from "../_shared/identity.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

/**
 * Agent-triggered partner/ambassador invitations.
 *
 * Lets an Agent (with the admin-granted `profiles.agent_can_invite_directly`
 * permission) send a durable invitation and bind the recruit to their own
 * network through `profiles.agent_id` (the exact mirror of master_partner_id).
 *
 * Only two roles can be invited here: social_media_partner and ambassador.
 * No password is ever generated or emailed — the invited person chooses their
 * own on /activate, and their role comes from the invitation row.
 */

type Role = "social_media_partner" | "ambassador";

const ROLE_MAP: Record<Role, { type: InvitationType; template: string; nameKey: string }> = {
  social_media_partner: { type: "partner", template: "partner-invite", nameKey: "partnerName" },
  ambassador: { type: "ambassador", template: "ambassador-invite", nameKey: "ambassadorName" },
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: userData, error: userError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData?.user) return json({ error: "Invalid token" }, 401);

    const agentId = userData.user.id;

    // ── Agent + permission gate ──────────────────────────────────────────
    // The caller must hold the 'agent' role AND carry the admin-granted direct
    // invite permission. Fetch both server-side (never trust the client body).
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", agentId)
      .eq("role", "agent")
      .limit(1);
    if (!roles?.length) return json({ error: "Agent access required" }, 403);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("agent_can_invite_directly, deleted_at, full_name")
      .eq("id", agentId)
      .maybeSingle();
    if (profileError || !profile || profile.deleted_at) {
      return json({ error: "Agent access required" }, 403);
    }
    if (!profile.agent_can_invite_directly) {
      return json({ error: "Direct invites are not enabled for this account" }, 403);
    }
    const agentName = profile.full_name ?? null;

    const parsed = await parseBody(
      req,
      z.object({
        email: emailField,
        full_name: personName,
        role: z.enum(["social_media_partner", "ambassador"]),
      }),
    );
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const body = parsed.data;

    const email = body.email.trim().toLowerCase();
    const role = body.role as Role;
    const cfg = ROLE_MAP[role];

    // One identity = one role. Never invite an email that already belongs to
    // any account — reusing it would attach a second role to somebody else's
    // login and make the two accounts inseparable.
    const conflict = await identityConflict(admin, email, role);
    if (conflict) return json(conflict.body, conflict.status);

    let activationUrl: string;
    try {
      activationUrl = await createInvitation(admin, {
        invitedEmail: email,
        invitationType: cfg.type,
        intendedRole: role,
        invitedName: body.full_name,
        inviterId: agentId,
        agentId: agentId,
      });
    } catch (e) {
      if (e instanceof InvitationConflictError) {
        return json({ error: e.message, code: "invitation_conflict" }, 409);
      }
      console.error("invitation creation failed", e);
      return json({ error: "Could not create the invitation" }, 500);
    }

    const sendResult = await sendAppEmail(cfg.template, email, {
      idempotencyKey: `${cfg.template}-${email}-${Date.now()}`,
      templateData: {
        [cfg.nameKey]: body.full_name,
        email,
        agentName,
        activationUrl,
      },
    });
    const emailed = sendResult.ok;
    if (!emailed) console.error("invite email failed", sendResult.detail);

    await admin.from("admin_audit_log").insert({
      admin_id: agentId,
      action: "agent_invite_recruit",
      target_id: null,
      details: `Agent invited ${email} as ${role}${emailed ? "" : " (email delivery failed)"}`,
    });

    return json({ success: true, emailed, email, role, activationUrl });
  } catch (e) {
    console.error("agent-invite-recruit error:", e);
    return json({ error: "Server error" }, 500);
  }
});