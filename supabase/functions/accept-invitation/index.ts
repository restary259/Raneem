import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverError } from "../_shared/errors.ts";
import { z, parseBody } from "../_shared/validate.ts";
import { hashToken, maskEmail, reconcilePendingInvitations } from "../_shared/invitations.ts";
import { resolveIdentity } from "../_shared/identity.ts";

/**
 * Public activation endpoint for durable invitations.
 *
 * Everything that determines *who* the account becomes — role, master partner,
 * case link — is read from the invitation row, never from the request body or
 * the URL, so a tampered link cannot re-point a recruit at another network.
 */
const STRONG_PASSWORD =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{10,}$/;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const parsed = await parseBody(
      req,
      z.object({
        token: z.string().min(10).max(200),
        email: z.string().trim().email().max(255),
        password: z.string().min(10).max(200),
      }),
    );
    if (!parsed.ok) return json({ error: parsed.error, code: "bad_request" }, 400);

    const { token, password } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    if (!STRONG_PASSWORD.test(password)) {
      return json({ error: "Password does not meet the policy", code: "weak_password" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token_hash = await hashToken(token);
    const { data: inv, error: invError } = await admin
      .from("user_invitations")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (invError) return json({ error: serverError(invError, "Failed to load invitation"), code: "server_error" }, 500);
    if (!inv) return json({ error: "Invitation not found", code: "invalid" }, 404);

    if (inv.status === "accepted") {
      return json({ error: "Invitation already accepted", code: "accepted" }, 409);
    }
    if (inv.status !== "pending") {
      return json({ error: "Invitation is no longer active", code: "revoked" }, 409);
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return json({ error: "Invitation expired", code: "expired" }, 410);
    }
    if (String(inv.invited_email).toLowerCase() !== email) {
      return json({ error: "Email does not match this invitation", code: "email_mismatch" }, 403);
    }

    // Labeled per-step logging: each phase reports success/failure under its
    // own label so a failed activation pinpoints the exact step in the edge
    // function logs. Never log the token or password. The email is masked via
    // the shared maskEmail helper to keep PII out of log lines.
    const logStep = (step: string, meta: Record<string, unknown> = {}) =>
      console.info(`accept-invitation:${step}`, {
        invitation_id: inv.id,
        invitation_type: inv.invitation_type,
        email: maskEmail(email),
        ...meta,
      });

    // ── Resolve the identity ──────────────────────────────────────────────
    // One identity = one role. The invitation may never take over an email
    // that already belongs to a DIFFERENT role: doing so would reset that
    // person's password and bolt a second role onto their identity, which then
    // makes deleting one "account" destroy the other. But an identity that was
    // already provisioned for THIS role — by an earlier approval step, a
    // resend race, or a refresh after a partial activation — is continuing its
    // activation, not a duplicate account, so it is adopted instead.
    const existing = await resolveIdentity(admin, email);

    if (existing.exists && existing.deactivated) {
      return json(
        {
          error:
            "This account has been deactivated. Ask an admin to reactivate it before continuing.",
          code: "identity_conflict",
          existing_role: existing.role,
          deactivated: true,
        },
        409,
      );
    }
    if (existing.exists && existing.role && existing.role !== inv.intended_role) {
      return json(
        {
          error:
            `This email already has the role ${existing.role}. One person can hold only one role in Darb.`,
          code: "identity_conflict",
          existing_role: existing.role,
          deactivated: existing.deactivated,
        },
        409,
      );
    }

    let userId: string;
    let created: boolean;

    if (existing.exists && existing.userId) {
      // Identity already provisioned (no role yet, or already this role) and
      // still needs activation — adopt it. The invitation token + email match
      // are the authorization to set the chosen password; no second auth
      // account is ever created.
      userId = existing.userId;
      created = false;
      const { error: adoptError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (adoptError) {
        logStep("adopt_or_create_failed", { mode: "adopt", error: adoptError.message });
        return json(
          { error: adoptError.message ?? "Account could not be updated", code: "server_error" },
          400,
        );
      }
      logStep("adopt_or_create", { mode: "adopt", user_id: userId });
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError || !createdUser?.user) {
        // createUser() fails with "Database error checking email" when the
        // email already exists in auth.users but resolveIdentity() missed it
        // (profile-row race or RPC unavailability). Re-resolve before
        // surfacing the error: a found identity is adopted under the same
        // guards as the primary adopt path above.
        logStep("create_failed_retrying_resolve", { error: createError?.message });
        const retryExisting = await resolveIdentity(admin, email);

        if (retryExisting.exists && retryExisting.userId && !retryExisting.deactivated) {
          if (retryExisting.role && retryExisting.role !== inv.intended_role) {
            logStep("retry_role_conflict", { found_role: retryExisting.role });
            return json(
              {
                error:
                  `This email already has the role ${retryExisting.role}. One person can hold only one role in Darb.`,
                code: "identity_conflict",
                existing_role: retryExisting.role,
              },
              409,
            );
          }
          userId = retryExisting.userId;
          created = false;
          const { error: adoptError } = await admin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          });
          if (adoptError) {
            logStep("retry_adopt_failed", { user_id: userId, error: adoptError.message });
            return json(
              { error: adoptError.message ?? "Account could not be updated", code: "server_error" },
              400,
            );
          }
          logStep("adopt_or_create", { mode: "retry_adopt", user_id: userId });
        } else {
          logStep("adopt_or_create_failed", { mode: "create", error: createError?.message });
          return json(
            { error: createError?.message ?? "Account could not be created", code: "server_error" },
            400,
          );
        }
      } else {
        userId = createdUser.user.id;
        created = true;
        logStep("adopt_or_create", { mode: "create", user_id: userId });
      }
    }

    // ── Role (idempotent; one role per user) ──────────────────────────────
    // onConflict targets the single-column unique index user_roles_one_role_per_user.
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: inv.intended_role },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    if (roleError) {
      logStep("role_upsert_failed", { user_id: userId, error: roleError.message });
      return json({ error: serverError(roleError, "Failed to assign role"), code: "server_error" }, 500);
    }
    logStep("role_upsert", { user_id: userId, role: inv.intended_role });

    // A concurrent accept for the same identity with a different role could
    // have won the arbiter — surface it instead of silently continuing.
    if (existing.exists && !existing.role) {
      const { data: now } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (now && now.role !== inv.intended_role) {
        logStep("concurrent_role_check_failed", { user_id: userId, found_role: now.role });
        return json(
          {
            error:
              `This email already has the role ${now.role}. One person can hold only one role in Darb.`,
            code: "identity_conflict",
            existing_role: now.role,
          },
          409,
        );
      }
    }
    logStep("concurrent_role_check", { user_id: userId });

    // ── Close the invitation ──────────────────────────────────────────────
    // The identity + role are now authoritative — this is the point of no
    // return. Close the invitation HERE, before any peripheral step, so the
    // invitation row and the account state can never disagree again, no
    // matter which later step fails. Guarded by status='pending' so a
    // concurrent activation is a no-op.
    const { error: closeError } = await admin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq("id", inv.id)
      .eq("status", "pending");
    if (closeError) {
      logStep("close_invitation_failed", { user_id: userId, error: closeError.message });
      return json({ error: serverError(closeError, "Failed to close invitation"), code: "server_error" }, 500);
    }
    logStep("close_invitation", { user_id: userId });

    // Close any sibling pending invitations of the same type for this email
    // (idempotent, non-fatal; the just-closed row is already accepted so only
    // genuine siblings are touched).
    await reconcilePendingInvitations(admin, {
      email,
      userId,
      invitationType: inv.invitation_type,
    });

    // ── Profile: only the columns this flow owns (non-fatal) ──────────────
    // The base profile row already exists (handle_new_user creates it the
    // instant the auth user exists). The columns patched here — display name,
    // agent link, case link — are reconcilable details, so a failure must
    // degrade to a logged warning instead of a 500 that leaves the account
    // active with the activation reporting failure.
    const profilePatch: Record<string, unknown> = {
      id: userId,
      email,
      must_change_password: false,
    };
    // Only seed the name for a brand-new account — never overwrite one the
    // person already set on an existing profile.
    if (created && inv.invited_name) profilePatch.full_name = inv.invited_name;
    // An Agent who recruits a partner/ambassador (or is invited as one
    // themselves) is linked through profiles.agent_id. Applies to
    // partner/ambassador recruits carrying an agent_id, and to a direct
    // "agent" invitation (the agent's own account).
    if (inv.agent_id) {
      profilePatch.agent_id = inv.agent_id;
    }
    if (inv.invitation_type === "student" && inv.case_id) {
      profilePatch.case_id = inv.case_id;
    }
    try {
      const { error: profileError } = await admin.from("profiles").upsert(profilePatch);
      if (profileError) {
        // The warn includes the full intended patch (no secrets — the columns
        // this flow owns are name/agent_id/case_id) because the invitation is
        // already closed and there is no client-side retry path left: this log
        // line is the only recovery handle for an operator to re-patch by hand.
        console.warn("accept_invitation_profile_patch_failed", {
          invitation_id: inv.id,
          user_id: userId,
          patch: { ...profilePatch, email: maskEmail(email) },
          error: profileError.message,
        });
      } else {
        logStep("profile_patch", { user_id: userId });
      }
    } catch (e) {
      console.warn("accept_invitation_profile_patch_failed", {
        invitation_id: inv.id,
        user_id: userId,
        patch: { ...profilePatch, email: maskEmail(email) },
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // ── Link the originating case to this exact user (best-effort) ────────
    if (inv.invitation_type === "student" && inv.case_id) {
      await admin
        .from("cases")
        .update({ student_user_id: userId })
        .eq("id", inv.case_id)
        .is("student_user_id", null);
      logStep("case_link", { user_id: userId, case_id: inv.case_id });
    }

    if (inv.recruit_application_id) {
      await admin
        .from("partner_recruit_applications")
        .update({ created_user_id: userId })
        .eq("id", inv.recruit_application_id);
      logStep("recruit_application", { user_id: userId, recruit_application_id: inv.recruit_application_id });
    }

    await admin.from("admin_audit_log").insert({
      admin_id: inv.inviter_id ?? null,
      action: "accept_invitation",
      target_id: userId,
      details: `${inv.invitation_type} invitation accepted by ${email}${
        created ? " (new account)" : " (existing account)"
      }`,
    });
    logStep("audit_log", { user_id: userId });

    return json({
      success: true,
      email,
      invitation_type: inv.invitation_type,
      role: inv.intended_role,
      created,
    });
  } catch (e) {
    console.error("accept-invitation error:", e);
    return json({ error: "Server error", code: "server_error" }, 500);
  }
});
