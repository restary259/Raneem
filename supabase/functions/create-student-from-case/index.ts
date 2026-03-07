import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Validate caller using service role key (handles ES256 JWTs)
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Team member access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { case_id, student_email, student_full_name, student_phone } = await req.json();

    if (!case_id || !student_email || !student_full_name) {
      return new Response(JSON.stringify({ error: "case_id, student_email, student_full_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if student account already exists for this case
    const { data: existingCase } = await supabaseAdmin
      .from("cases")
      .select(
        "student_user_id, city, education_level, passport_type, degree_interest, intake_notes, full_name, phone_number",
      )
      .eq("id", case_id)
      .single();
    if (existingCase?.student_user_id) {
      return new Response(
        JSON.stringify({
          success: true,
          user_id: existingCase.student_user_id,
          invited: false,
          message: "Student account already exists",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build profile payload from case data
    const profilePayload = {
      email: student_email,
      full_name: student_full_name,
      phone_number: student_phone ?? existingCase?.phone_number ?? null,
      city: existingCase?.city ?? null,
      must_change_password: true, // always require password change on first login
    };

    // ── ACCOUNT CREATION STRATEGY ──────────────────────────────────────────
    // Always generate a temporary password (never send an email invite).
    // The admin receives the temp password in the response and shares it
    // with the student manually. The student MUST change it on first login
    // (enforced via must_change_password = true on the profile).
    //
    // Rationale: invite emails require SMTP configuration that may not always
    // be available, and the product spec requires the temp-password flow.

    let studentId: string;
    let tempPassword: string | null = null;

    // Check if user already exists with this email
    const existingUsersList = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsersList.data?.users?.find((u: any) => u.email === student_email);

    if (existingUser) {
      // User already has an auth account — just link the case
      studentId = existingUser.id;
    } else {
      // Generate a secure temporary password:
      // 12 chars from a safe alphabet + mandatory uppercase, digit, and symbol
      // so it satisfies any Supabase password policy.
      tempPassword =
        Array.from(crypto.getRandomValues(new Uint8Array(9)))
          .map((b) => "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"[b % 54])
          .join("") + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: student_email,
        password: tempPassword,
        email_confirm: true, // bypass email confirmation — admin handles onboarding
        user_metadata: {
          full_name: student_full_name,
          phone_number: student_phone ?? "",
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      studentId = newUser.user.id;
    }

    // Assign student role (ignore if already exists)
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // Upsert profile with all case data
    await supabaseAdmin.from("profiles").upsert({
      id: studentId,
      ...profilePayload,
    });

    // Link case to student
    await supabaseAdmin.from("cases").update({ student_user_id: studentId }).eq("id", case_id);

    // Audit log
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .single();
    await supabaseAdmin.rpc("log_activity", {
      p_actor_id: callerId,
      p_actor_name: callerProfile?.full_name ?? "Team Member",
      p_action: "student_account_created",
      p_entity_type: "case",
      p_entity_id: case_id,
      p_metadata: {
        student_email,
        student_full_name,
        student_id: studentId,
        temp_password_issued: tempPassword !== null,
      },
    });

    const responsePayload: Record<string, unknown> = {
      success: true,
      user_id: studentId,
      email: student_email,
      invited: false,
      message: tempPassword
        ? "Student account created with temporary password"
        : "Student account linked (existing user)",
    };

    // Only return temp_password if we generated one (never log it)
    if (tempPassword) {
      responsePayload.temp_password = tempPassword;
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-student-from-case error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
