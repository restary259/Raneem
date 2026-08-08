import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
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
      role: z.enum(["team_member", "admin", "social_media_partner", "ambassador"]),
      commission_amount: z.number().int().min(0).max(1000000).optional().nullable(),
      // Set when the new partner was recruited by a master partner.
      master_partner_id: z.string().uuid().optional().nullable(),
    }));
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = parsed.data;
    const { email, full_name, role, commission_amount, master_partner_id } = body;

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

    if (!["team_member", "social_media_partner", "ambassador"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbRole = role;

    const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";

    let userId: string | null = null;
    let reusedExisting = false;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      const alreadyExists = /already/i.test(createError.message ?? "");
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Account already exists — reuse it and just (re)assign the role/profile.
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      userId = existing?.id ?? null;
      if (!userId) {
        // Fall back to scanning auth users when no profile row exists yet.
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
        )?.id ?? null;
      }
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "This email is already registered but the account could not be found." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      reusedExisting = true;
    } else {
      userId = newUser.user.id;
    }

    if (reusedExisting) {
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", dbRole)
        .maybeSingle();
      if (existingRole) {
        return new Response(
          JSON.stringify({ error: `This user already exists and already has the ${dbRole} role.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: dbRole,
    });

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      // Existing accounts keep their current password state.
      must_change_password: reusedExisting ? undefined : true,
      commission_amount: typeof commission_amount === "number" ? commission_amount : 0,
      // Only partners can belong to a master partner's network.
      master_partner_id:
        dbRole === "social_media_partner" && master_partner_id ? master_partner_id : null,
    });


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
        temp_password: reusedExisting ? null : tempPassword,
        message: reusedExisting
          ? `Existing account found — ${dbRole} role added. The user keeps their current password.`
          : `${dbRole} account created.`,

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
