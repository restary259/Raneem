import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { identityConflict, resolveIdentity } from "../_shared/identity.ts";
import { z, parseBody, email as emailField, personName } from "../_shared/validate.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Use admin client to verify the token (works with ES256 JWTs)
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminId = userData.user.id;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin");

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = await parseBody(req, z.object({
      email: emailField,
      full_name: personName,
      role: z.enum(["team_member", "admin", "social_media_partner", "ambassador", "agent"]),
      commission_amount: z.number().int().min(0).max(1000000).optional().nullable(),
      // Set when the new partner/ambassador was recruited by an Agent, or when
      // creating the Agent's own account under one.
      agent_id: z.string().uuid().optional().nullable(),
    }));
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = parsed.data;
    const { email, full_name, role, commission_amount, agent_id } = body;

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Email, full_name, and role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.length > 100) {
      return new Response(JSON.stringify({ error: "Full name must be 1-100 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["team_member", "social_media_partner", "ambassador", "agent"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbRole = role;

    const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";

    // One identity = one role: refuse any email that already has an account.
    const conflict = await identityConflict(supabaseAdmin, email, dbRole);
    if (conflict) {
      return new Response(JSON.stringify(conflict.body), {
        status: conflict.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    let created: boolean;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser?.user) {
      // createUser() fails with "Database error checking email" when the email
      // already exists in auth.users but identityConflict's resolveIdentity()
      // missed it (profile-row race or RPC unavailability). Re-resolve and
      // adopt under the same one-identity-one-role guards.
      const retryExisting = await resolveIdentity(supabaseAdmin, email);
      if (retryExisting.exists && retryExisting.userId && !retryExisting.deactivated) {
        if (retryExisting.role && retryExisting.role !== dbRole) {
          return new Response(
            JSON.stringify({
              error: `This email already has the role ${retryExisting.role}. One person can hold only one role in Darb.`,
              code: "identity_conflict",
              existing_role: retryExisting.role,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        userId = retryExisting.userId;
        created = false;
        // Set the temp password so the admin receives working credentials.
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
        });
        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message ?? "Account could not be updated" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: createError?.message ?? "Account could not be created" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      userId = newUser.user.id;
      created = true;
    }

    // Idempotent: an adopted account may already carry this role row.
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: dbRole },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      commission_amount: typeof commission_amount === "number" ? commission_amount : 0,
      // Agent link: partners/ambassadors recruited by an Agent, or the
      // Agent's own account. An agent can never sit under another agent
      // (enforce_agent_graph forbids multi-level chaining), and a
      // team_member belongs to no recruitment network.
      agent_id:
        (dbRole === "social_media_partner" || dbRole === "ambassador" || dbRole === "agent") && agent_id
          ? agent_id
          : null,
    });

    // Stamp must_change_password in a dedicated UPDATE so it fires AFTER
    // handle_new_user has created the profile row (avoids the upsert/trigger
    // race where the upsert lands before the trigger row exists). Applies to
    // adopted accounts too: their password was just replaced with the temp one.
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);


    await supabaseAdmin
      .from("influencer_invites")
      .update({ status: "accepted", created_user_id: userId })
      .eq("email", email);

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: `create_${dbRole}`,
      target_id: userId,
      details: `Created ${dbRole} account for ${email}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        role: dbRole,
        temp_password: tempPassword,
        message: created
          ? `${dbRole} account created.`
          : `Existing ${dbRole} account adopted — the temp password below replaces the old one.`,

      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Create team member error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
