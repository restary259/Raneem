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
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
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
    const { data: existingCase } = await supabaseAdmin.from("cases").select("student_user_id").eq("id", case_id).single();
    if (existingCase?.student_user_id) {
      return new Response(JSON.stringify({ success: true, user_id: existingCase.student_user_id, message: "Student account already exists" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: student_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: student_full_name, phone_number: student_phone ?? "" },
    });

    if (createError) {
      // If user already exists, look them up
      if (createError.message.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === student_email);
        if (existingUser) {
          await supabaseAdmin.from("cases").update({ student_user_id: existingUser.id }).eq("id", case_id);
          return new Response(JSON.stringify({ success: true, user_id: existingUser.id, message: "Linked existing user" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const studentId = newUser.user.id;

    // Assign student role
    await supabaseAdmin.from("user_roles").insert({ user_id: studentId, role: "student" });

    // Update profile
    await supabaseAdmin.from("profiles").upsert({
      id: studentId,
      email: student_email,
      full_name: student_full_name,
      phone_number: student_phone ?? null,
      must_change_password: true,
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
      p_metadata: { student_email, student_full_name, student_id: studentId },
    });

    return new Response(JSON.stringify({
      success: true,
      user_id: studentId,
      email: student_email,
      temp_password: tempPassword,
      message: "Student account created",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-student-from-case error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
