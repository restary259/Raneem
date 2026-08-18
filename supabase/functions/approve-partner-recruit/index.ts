import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverError } from "../_shared/errors.ts";
import { z, parseBody } from "../_shared/validate.ts";
import { createInvitation, InvitationConflictError } from "../_shared/invitations.ts";
import { resolveIdentity } from "../_shared/identity.ts";


/**
 * Single, retry-safe entry point for approving a partner recruit application.
 *
 * Everything the approval needs happens server-side and is derived from the
 * application row itself (never from the client body): the durable invitation,
 * the agent link, the status flip and the branded invite mail.
 *
 * The auth account is intentionally NOT created here. The invite-mode pattern
 * (mirroring create-student-from-case) lets accept-invitation be the single
 * point that creates the identity, assigns the social_media_partner role,
 * links the master partner and closes the invitation at activation. Pre-creating
 * the account here produced a dead activation link — accept-invitation rejected
 * the email with "already belongs to an account".
 */
serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

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
        application_id: z.string().uuid(),
        action: z.enum(["approve", "resend_invite"]).optional(),
      }),
    );
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const applicationId = parsed.data.application_id;
    const action = parsed.data.action ?? "approve";

    // ---- Load the application -------------------------------------------
    // agent_id is set when the recruit applied via an Agent's /join/AG-XXXX
    // link (ensure_agent_recruit_link). When present, the recruit is linked to
    // the agent (profiles.agent_id) at activation.
    const { data: app, error: appError } = await admin
      .from("partner_recruit_applications")
      .select("id, full_name, email, status, agent_id, intended_role, created_user_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError) return json({ error: serverError(appError, "Failed to load application") }, 500);
    if (!app) return json({ error: "Application not found" }, 404);

    const email = String(app.email ?? "").trim().toLowerCase();
    const fullName = String(app.full_name ?? "").trim();
    if (!email || !fullName) return json({ error: "Application is missing an email or name" }, 400);

    // ---- Validate the recruiter ------------------------------------------
    const agentId = (app.agent_id as string | null) ?? null;
    if (!agentId) return json({ error: "Application has no recruiting agent" }, 409);

    const { data: agent } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", agentId)
      .maybeSingle();
    if (!agent) return json({ error: "The recruiting agent profile no longer exists" }, 409);
    const { data: agentRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", agentId)
      .eq("role", "agent")
      .maybeSingle();
    if (!agentRole) return json({ error: "The recruiting account is no longer an agent" }, 409);

    const recruiterName = (agent.full_name as string | null) ?? null;


    /**
     * Durable invitation link + branded invite. Never emails a password, and
     * the recruiter attribution (agent_id) lives on the invitation row, not
     * in the URL. accept-invitation stamps the matching profile column at
     * activation.
     */

    async function sendInvite(targetEmail: string) {
      let activationUrl: string;
      try {
        activationUrl = await createInvitation(admin, {
          invitedEmail: targetEmail,
          invitationType: "partner",
          intendedRole: (app.intended_role as "social_media_partner" | "ambassador") ?? "social_media_partner",
          inviterId: adminId,
          agentId: agentId ?? undefined,
          recruitApplicationId: applicationId,
        });
      } catch (e) {
        // The recruit's live invitation belongs to another recruiter — surface
        // it as a 409 (handled by the caller), never as a generic failure.
        if (e instanceof InvitationConflictError) throw e;
        console.error("invitation creation failed", e);
        return false;
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
            templateName: "partner-invite",
            recipientEmail: targetEmail,
            idempotencyKey: `partner-invite-${applicationId}-${Date.now()}`,
            templateData: {
              partnerName: fullName,
              email: targetEmail,
              masterName: recruiterName,
              activationUrl,
            },
          }),
        },
      );
      if (!resp.ok) console.error("partner invite email failed", await resp.text());
      return resp.ok;
    }

    // ---- Resend on an already approved application ------------------------
    if (action === "resend_invite") {
      if (app.status !== "approved") {
        return json({ error: "Only approved applications can be re-invited" }, 409);
      }
      const identity = await resolveIdentity(admin, email);
      if (identity.exists && identity.role === "social_media_partner") {
        return json({ success: true, emailed: false, already_activated: true, email });
      }
      const emailed = await sendInvite(email);
      await admin.from("admin_audit_log").insert({
        admin_id: adminId,
        action: "resend_partner_invite",
        target_id: app.created_user_id,
        details: `Resent partner activation email to ${email}`,
      });
      return json({ success: true, emailed, email });
    }

    // ---- Idempotent double-approve ----------------------------------------
    if (app.status === "approved") {
      return json({ success: true, already_approved: true, emailed: false, email });
    }
    if (app.status !== "pending") {
      return json({ error: `Application is ${app.status}` }, 409);
    }

    // ---- Resolve the recruit's identity -----------------------------------
    // An existing identity may only be adopted when it is already a partner
    // (idempotent approve) or when it has no role yet (activated later by
    // accept-invitation). A different role or a deactivated account is a hard
    // conflict — never a silent reuse (that would violate one-role-per-user
    // and could reset somebody else's password).
    const identity = await resolveIdentity(admin, email);

    if (identity.exists && identity.deactivated) {
      return json(
        {
          error:
            "This email belongs to a deactivated account. Reactivate that account instead, or use a different email.",
          code: "identity_conflict",
          existing_role: identity.role,
          deactivated: true,
        },
        409,
      );
    }
    if (identity.exists && identity.role && identity.role !== "social_media_partner") {
      return json(
        {
          error:
            `This email already belongs to a ${identity.role} account. One person can hold only one role in Darb — use a different email.`,
          code: "identity_conflict",
          existing_role: identity.role,
          deactivated: identity.deactivated,
        },
        409,
      );
    }

    const alreadyActivated =
      identity.exists && identity.role === "social_media_partner";

    // ---- Flip the application (no account is created here) -----------------
    // created_user_id is set to the recruit's existing identity when there is
    // one, and is backfilled by accept-invitation for brand-new identities at
    // activation time.
    const { error: statusError } = await admin
      .from("partner_recruit_applications")
      .update({
        status: "approved",
        created_user_id: identity.exists ? identity.userId : null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (statusError) return json({ error: serverError(statusError, "Failed to approve application") }, 500);

    // Already an active partner: no new account, no duplicate role, no dead
    // email. Just confirm the approval.
    if (alreadyActivated) {
      await admin.from("admin_audit_log").insert({
        admin_id: adminId,
        action: "approve_partner_recruit",
        target_id: identity.userId,
        details: `Approved ${email} into ${recruiterName ?? "recruiter"}'s network (account already active)`,
      });
      return json({
        success: true,
        user_id: identity.userId,
        email,
        emailed: false,
        reused_existing: true,
        already_activated: true,
      });
    }

    let emailed: boolean;
    try {
      emailed = await sendInvite(email);
    } catch (e) {
      if (e instanceof InvitationConflictError) {
        // The recruit already belongs to another recruiter's network. Revert the
        // premature approval so the application can be re-reviewed, and tell the
        // admin who owns the pending invitation.
        await admin
          .from("partner_recruit_applications")
          .update({ status: "pending", reviewed_by: null, reviewed_at: null })
          .eq("id", applicationId);
        return json({ error: e.message, code: "invitation_conflict" }, 409);
      }
      throw e;
    }

    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "approve_partner_recruit",
      target_id: identity.userId ?? null,
      details: `Approved ${email} into ${recruiterName ?? "recruiter"}'s network${
        emailed ? " and sent the activation email" : " (activation email failed)"
      }`,
    });

    return json({
      success: true,
      user_id: identity.userId ?? null,
      email,
      emailed,
      reused_existing: identity.exists,
    });
  } catch (e) {
    if (e instanceof InvitationConflictError) {
      console.error("approve-partner-recruit invitation conflict:", e.message);
      return json({ error: e.message, code: "invitation_conflict" }, 409);
    }
    console.error("approve-partner-recruit error:", e);
    return json({ error: "Server error" }, 500);
  }
});
