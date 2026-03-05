import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Validate caller using service role key (handles ES256 JWTs)
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Team member access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { case_id, student_email, student_full_name, student_phone } = await req.json();

    if (!case_id || !student_email || !student_full_name) {
      return new Response(JSON.stringify({ error: "case_id, student_email, student_full_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if student account already exists for this case
    const { data: existingCase } = await supabaseAdmin.from("cases").select("student_user_id, city, education_level, passport_type, degree_interest, intake_notes, full_name, phone_number").eq("id", case_id).single();
    if (existingCase?.student_user_id) {
      return new Response(JSON.stringify({ success: true, user_id: existingCase.student_user_id, invited: false, message: "Student account already exists" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build profile payload from case data
    const profilePayload = {
      email: student_email,
      full_name: student_full_name,
      phone_number: student_phone ?? existingCase?.phone_number ?? null,
      city: existingCase?.city ?? null,
      must_change_password: false, // invite flow — student sets own password
    };

    // --- Try inviteUserByEmail (preferred) ---
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(student_email, {
      data: { full_name: student_full_name },
      redirectTo: "https://darb-agency.lovable.app/student-auth",
    });

    let studentId: string;
    let usedInvite = true;
    let tempPassword: string | null = null;

    if (!inviteError && inviteData?.user) {
      // Invite succeeded
      studentId = inviteData.user.id;
    } else {
      // Fallback: check if user already exists (email already registered)
      const existingUsersList = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = existingUsersList.data?.users?.find((u: any) => u.email === student_email);

      if (existingUser) {
        studentId = existingUser.id;
        usedInvite = false;
      } else {
        // Create with temp password as last resort
        tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(9)))
          .map(b => "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#"[b % 58])
          .join("") + "Aa1!";

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: student_email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: student_full_name, phone_number: student_phone ?? "" },
        });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        studentId = newUser.user.id;
        usedInvite = false;
        profilePayload.must_change_password = true;
      }
    }

    // Assign student role (ignore if already exists)
    await supabaseAdmin.from("user_roles").upsert({ user_id: studentId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // Upsert profile with all case data
    await supabaseAdmin.from("profiles").upsert({
      id: studentId,
      ...profilePayload,
    });

    // Link case to student
    await supabaseAdmin.from("cases").update({ student_user_id: studentId }).eq("id", case_id);

    // Audit log
    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", callerId).single();
    await supabaseAdmin.rpc("log_activity", {
      p_actor_id: callerId,
      p_actor_name: callerProfile?.full_name ?? "Team Member",
      p_action: "student_account_created",
      p_entity_type: "case",
      p_entity_id: case_id,
      p_metadata: { student_email, student_full_name, student_id: studentId, invite_sent: usedInvite },
    });

    const responsePayload: Record<string, unknown> = {
      success: true,
      user_id: studentId,
      email: student_email,
      invited: usedInvite,
      message: usedInvite ? "Invite email sent to student" : "Student account created with temporary password",
    };

    // Only return temp_password if we actually generated one (never log it)
    if (!usedInvite && tempPassword) {
      responsePayload.temp_password = tempPassword;
    }

    return new Response(JSON.stringify(responsePayload), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-student-from-case error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
