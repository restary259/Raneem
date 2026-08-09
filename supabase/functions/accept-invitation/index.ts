import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody } from "../_shared/validate.ts";
import { hashToken } from "../_shared/invitations.ts";

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
    if (invError) return json({ error: invError.message, code: "server_error" }, 500);
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

    // ── Create or reuse the auth account (never a duplicate) ──────────────
    let userId: string | null = null;
    let created = false;

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      if (!/already/i.test(createError.message ?? "")) {
        return json({ error: createError.message, code: "server_error" }, 400);
      }
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      userId = profile?.id ?? null;
      if (!userId) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list?.users?.find((u: { email?: string; id: string }) =>
          (u.email ?? "").toLowerCase() === email
        )?.id ?? null;
      }
      if (!userId) return json({ error: "Account could not be resolved", code: "server_error" }, 409);

      const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (pwError) return json({ error: pwError.message, code: "server_error" }, 400);
    } else {
      userId = createdUser.user.id;
      created = true;
    }

    // ── Role (idempotent) ─────────────────────────────────────────────────
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: inv.intended_role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (roleError) return json({ error: roleError.message, code: "server_error" }, 500);

    // ── Profile: only the columns this flow owns ──────────────────────────
    const profilePatch: Record<string, unknown> = {
      id: userId,
      email,
      must_change_password: false,
    };
    if (inv.invitation_type === "partner" && inv.master_partner_id) {
      profilePatch.master_partner_id = inv.master_partner_id;
    }
    if (inv.invitation_type === "student" && inv.case_id) {
      profilePatch.case_id = inv.case_id;
    }
    const { error: profileError } = await admin.from("profiles").upsert(profilePatch);
    if (profileError) return json({ error: profileError.message, code: "server_error" }, 500);

    // ── Link the originating case to this exact user ──────────────────────
    if (inv.invitation_type === "student" && inv.case_id) {
      await admin
        .from("cases")
        .update({ student_user_id: userId })
        .eq("id", inv.case_id)
        .is("student_user_id", null);
    }

    // ── Close the invitation ──────────────────────────────────────────────
    const { error: closeError } = await admin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
      })
      .eq("id", inv.id)
      .eq("status", "pending");
    if (closeError) return json({ error: closeError.message, code: "server_error" }, 500);

    if (inv.recruit_application_id) {
      await admin
        .from("partner_recruit_applications")
        .update({ created_user_id: userId })
        .eq("id", inv.recruit_application_id);
    }

    await admin.from("admin_audit_log").insert({
      admin_id: inv.inviter_id ?? null,
      action: "accept_invitation",
      target_id: userId,
      details: `${inv.invitation_type} invitation accepted by ${email}${
        created ? " (new account)" : " (existing account)"
      }`,
    });

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
