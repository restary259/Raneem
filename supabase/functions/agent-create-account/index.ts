import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody, email as emailField, personName } from "../_shared/validate.ts";
import { identityConflict, resolveIdentity } from "../_shared/identity.ts";
import { reconcilePendingInvitations } from "../_shared/invitations.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

/**
 * Agent-triggered manual account creation for a recruited partner or ambassador.
 *
 * When the agent has the admin-granted `profiles.agent_can_create_accounts`
 * permission, they can create the account directly (with a temp password)
 * instead of sending an email invitation. The new account is immediately
 * linked to the agent's network (profiles.agent_id = agentId).
 *
 * Mirrors create-team-member but:
 *  - Gates on the 'agent' role + agent_can_create_accounts (not admin).
 *  - Only allows social_media_partner / ambassador roles.
 *  - Stamps agent_id on the profile so the recruit joins the agent's network.
 *  - Reconciles any pending invitation for the email (closes stale invites).
 *  - No password is ever emailed — the agent receives it in the dashboard
 *    response and shares it securely with the recruit.
 */

type Role = "social_media_partner" | "ambassador";

const ROLE_LABEL: Record<Role, string> = {
  social_media_partner: "partner",
  ambassador: "ambassador",
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
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", agentId)
      .eq("role", "agent")
      .limit(1);
    if (!roles?.length) return json({ error: "Agent access required" }, 403);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("agent_can_create_accounts, deleted_at, full_name")
      .eq("id", agentId)
      .maybeSingle();
    if (profileError || !profile || profile.deleted_at) {
      return json({ error: "Agent access required" }, 403);
    }
    if (!profile.agent_can_create_accounts) {
      return json({ error: "Manual account creation is not enabled for this account" }, 403);
    }

    const parsed = await parseBody(
      req,
      z.object({
        email: emailField,
        full_name: personName,
        role: z.enum(["social_media_partner", "ambassador"]),
        phone: z.string().max(30).optional(),
        city: z.string().max(100).optional(),
      }),
    );
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const body = parsed.data;

    const email = body.email.trim().toLowerCase();
    const role = body.role as Role;

    // One identity = one role. Never create an account for an email that
    // already belongs to any account.
    const conflict = await identityConflict(admin, email, role);
    if (conflict) return json(conflict.body, conflict.status);

    const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";

    let userId: string;

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });

    if (createError || !newUser?.user) {
      // createUser() fails with "Database error checking email" when the email
      // already exists in auth.users but identityConflict's resolveIdentity()
      // missed it. Re-resolve and adopt under the same guards.
      const retryExisting = await resolveIdentity(admin, email);
      if (retryExisting.exists && retryExisting.userId && !retryExisting.deactivated) {
        if (retryExisting.role && retryExisting.role !== role) {
          return json({
            error: `This email already has the role ${retryExisting.role}. One person can hold only one role in Darb.`,
            code: "identity_conflict",
            existing_role: retryExisting.role,
          }, 409);
        }
        userId = retryExisting.userId;
        // Set the temp password so the agent receives working credentials.
        const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
        });
        if (updateError) {
          return json({ error: updateError.message ?? "Account could not be updated" }, 400);
        }
      } else {
        return json({ error: createError?.message ?? "Account could not be created" }, 400);
      }
    } else {
      userId = newUser.user.id;
    }

    // Idempotent: an adopted account may already carry this role row.
    await admin.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

    const { error: upsertError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: body.full_name,
      phone_number: body.phone?.trim() || null,
      city: body.city?.trim() || null,
      commission_amount: 0,
    });
    if (upsertError) console.error("profile upsert error:", upsertError);

    // Separately stamp the agent-controlled fields — must be a dedicated UPDATE
    // so it fires AFTER handle_new_user has created the profile row. Runs for
    // adopted accounts too: the recruit must join this agent's network, and
    // their password was just replaced with the temp one. The temp password
    // must never reach the caller unless the forced-change flag is confirmed
    // persisted, so verify with a re-select after the update.
    const { error: stampError } = await admin.from("profiles")
      .update({ agent_id: agentId, must_change_password: true })
      .eq("id", userId);
    if (stampError) {
      console.error("profile stamp error:", stampError, { userId });
      return json({ error: "Could not link account to agent network" }, 500);
    }

    const { data: stampCheck, error: stampCheckError } = await admin
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    if (stampCheckError || stampCheck?.must_change_password !== true) {
      // userId is logged deliberately: on this path the account exists but its
      // temp password was never returned to anyone — this line is the only
      // recovery handle for an operator.
      console.error("must_change_password verification failed:", stampCheckError ?? stampCheck, { userId });
      return json({ error: "Account created but password-change flag could not be verified" }, 500);
    }

    // Close any pending invitation for this email so it doesn't linger.
    await reconcilePendingInvitations(admin, {
      email,
      userId,
      invitationType: ROLE_LABEL[role] as "partner" | "ambassador",
    });

    // Send the branded DARB welcome/credentials email so the recruit gets a
    // professional notification even when created manually. Uses the fallback
    // invitation template if no dedicated one exists.
    try {
      await sendAppEmail(`${ROLE_LABEL[role]}-invite`, email, {
        idempotencyKey: `agent-manual-${email}-${Date.now()}`,
        templateData: {
          [ROLE_LABEL[role] === "partner" ? "partnerName" : "ambassadorName"]: body.full_name,
          email,
          agentName: profile.full_name,
          activationUrl: null,
        },
      });
    } catch (e) {
      console.error("manual account welcome email failed", e);
    }

    await admin.from("admin_audit_log").insert({
      admin_id: agentId,
      action: "agent_create_account",
      target_id: userId,
      details: `Agent manually created ${role} account for ${email}`,
    });

    return json({ success: true, user_id: userId, email, role, temp_password: tempPassword });
  } catch (e) {
    console.error("agent-create-account error:", e);
    return json({ error: "Server error" }, 500);
  }
});
