import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody } from "../_shared/validate.ts";
import { createInvitation } from "../_shared/invitations.ts";


/**
 * Single, retry-safe entry point for approving a partner recruit application.
 *
 * Everything the approval needs happens server-side and is derived from the
 * application row itself (never from the client body): account creation, role
 * assignment, master-partner linking, status flip and the branded invite mail.
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
    const { data: app, error: appError } = await admin
      .from("partner_recruit_applications")
      .select("id, full_name, email, status, master_partner_id, created_user_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError) return json({ error: appError.message }, 500);
    if (!app) return json({ error: "Application not found" }, 404);

    const email = String(app.email ?? "").trim().toLowerCase();
    const fullName = String(app.full_name ?? "").trim();
    if (!email || !fullName) return json({ error: "Application is missing an email or name" }, 400);

    // ---- Validate the recruiting master partner --------------------------
    const { data: master } = await admin
      .from("profiles")
      .select("id, full_name, is_master_partner")
      .eq("id", app.master_partner_id)
      .maybeSingle();
    if (!master) return json({ error: "The recruiting partner profile no longer exists" }, 409);
    if (!master.is_master_partner) {
      return json({ error: "The recruiting partner is no longer a master partner" }, 409);
    }

    /**
     * Durable invitation link + branded invite. Never emails a password, and the
     * master-partner attribution lives on the invitation row, not in the URL.
     */
    async function sendInvite(targetEmail: string) {
      let activationUrl: string;
      try {
        activationUrl = await createInvitation(admin, {
          invitedEmail: targetEmail,
          invitationType: "partner",
          intendedRole: "social_media_partner",
          inviterId: adminId,
          masterPartnerId: app.master_partner_id,
          recruitApplicationId: applicationId,
        });
      } catch (e) {
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
              masterName: master.full_name ?? null,
              activationUrl: link.properties.action_link,
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
      const emailed = await sendInvite(email);
      await admin.from("admin_audit_log").insert({
        admin_id: adminId,
        action: "resend_partner_invite",
        target_id: app.created_user_id,
        details: `Resent partner activation email to ${email}`,
      });
      return json({ success: true, emailed, email });
    }

    if (app.status === "approved") {
      return json({ error: "This application was already approved" }, 409);
    }
    if (app.status !== "pending") {
      return json({ error: `Application is ${app.status}` }, 409);
    }

    // ---- Create or reuse the auth account ---------------------------------
    let userId: string | null = null;
    let isNewAccount = false;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID() + "aA1!",
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      if (!/already/i.test(createError.message ?? "")) {
        return json({ error: createError.message }, 400);
      }
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      userId = existingProfile?.id ?? null;
      if (!userId) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId =
          list?.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
      }
      if (!userId) {
        return json(
          { error: "This email is already registered but the account could not be found." },
          409,
        );
      }
    } else {
      userId = created.user.id;
      isNewAccount = true;
    }

    // ---- Role + network link (idempotent) ---------------------------------
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "social_media_partner")
      .maybeSingle();
    if (!existingRole) {
      const { error: roleError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "social_media_partner" });
      if (roleError) return json({ error: roleError.message }, 500);
    }

    // Only the columns this flow owns — no blanket profile reset.
    const profilePatch: Record<string, unknown> = {
      id: userId,
      email,
      full_name: fullName,
      master_partner_id: app.master_partner_id,
    };
    if (isNewAccount) profilePatch.must_change_password = true;
    const { error: profileError } = await admin.from("profiles").upsert(profilePatch);
    if (profileError) return json({ error: profileError.message }, 500);

    // ---- Flip the application ---------------------------------------------
    const { error: statusError } = await admin
      .from("partner_recruit_applications")
      .update({
        status: "approved",
        created_user_id: userId,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (statusError) return json({ error: statusError.message }, 500);

    const emailed = await sendInvite(email);

    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "approve_partner_recruit",
      target_id: userId,
      details: `Approved ${email} into ${master.full_name ?? "master partner"}'s network${
        emailed ? " and sent the activation email" : " (activation email failed)"
      }`,
    });

    return json({
      success: true,
      user_id: userId,
      email,
      emailed,
      reused_existing: !isNewAccount,
    });
  } catch (e) {
    console.error("approve-partner-recruit error:", e);
    return json({ error: "Server error" }, 500);
  }
});
