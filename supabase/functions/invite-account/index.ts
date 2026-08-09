import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody, email as emailField, personName } from "../_shared/validate.ts";
import { createInvitation, InvitationType } from "../_shared/invitations.ts";
import { identityConflict } from "../_shared/identity.ts";

/**
 * Admin-triggered account invitations.
 *
 * Creates (or refreshes) a durable invitation row and sends the branded
 * activation email. No password is ever generated or emailed: the invited
 * person chooses their own on /activate, and their role comes from the
 * invitation row, never from the link.
 */

type Role = "team_member" | "social_media_partner" | "ambassador";

const ROLE_MAP: Record<Role, { type: InvitationType; template: string; nameKey: string }> = {
  team_member: { type: "team", template: "team-invite", nameKey: "memberName" },
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

    const adminId = userData.user.id;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (!roles?.length) return json({ error: "Admin access required" }, 403);

    const parsed = await parseBody(
      req,
      z.object({
        action: z.enum(["send", "revoke"]).default("send"),
        email: emailField.optional(),
        full_name: personName.optional(),
        role: z.enum(["team_member", "social_media_partner", "ambassador"]).optional(),
        invitation_id: z.string().uuid().optional(),
      }),
    );
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const body = parsed.data;

    // ── Revoke a pending invitation ───────────────────────────────────────
    if (body.action === "revoke") {
      if (!body.invitation_id) return json({ error: "invitation_id is required" }, 400);
      const { error } = await admin
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("id", body.invitation_id)
        .eq("status", "pending");
      if (error) return json({ error: error.message }, 500);
      await admin.from("admin_audit_log").insert({
        admin_id: adminId,
        action: "revoke_invitation",
        target_id: null,
        details: `Revoked invitation ${body.invitation_id}`,
      });
      return json({ success: true });
    }

    // ── Send / resend an invitation ───────────────────────────────────────
    if (!body.email || !body.full_name || !body.role) {
      return json({ error: "email, full_name and role are required" }, 400);
    }
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
        inviterId: adminId,
      });
    } catch (e) {
      console.error("invitation creation failed", e);
      return json({ error: "Could not create the invitation" }, 500);
    }

    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          templateName: cfg.template,
          recipientEmail: email,
          idempotencyKey: `${cfg.template}-${email}-${Date.now()}`,
          templateData: {
            [cfg.nameKey]: body.full_name,
            email,
            activationUrl,
          },
        }),
      },
    );
    const emailed = resp.ok;
    if (!emailed) console.error("invite email failed", await resp.text());

    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: `invite_${role}`,
      target_id: null,
      details: `Invited ${email} as ${role}${emailed ? "" : " (email delivery failed)"}`,
    });

    return json({ success: true, emailed, email, role, activationUrl });
  } catch (e) {
    console.error("invite-account error:", e);
    return json({ error: "Server error" }, 500);
  }
});
