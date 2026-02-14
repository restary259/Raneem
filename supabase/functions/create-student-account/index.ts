import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
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

    const body = await req.json();
    const { case_id, email, full_name } = body;

    if (!case_id || !email || !full_name) {
      return new Response(JSON.stringify({ error: "case_id, email, and full_name required" }), {
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

    // Check if case exists and doesn't already have a student account
    const { data: caseData, error: caseError } = await supabaseAdmin
      .from("student_cases")
      .select("id, student_profile_id, student_phone, selected_city, selected_school")
      .eq("id", case_id)
      .single();

    if (caseError || !caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (caseData.student_profile_id) {
      return new Response(JSON.stringify({ error: "Student account already exists for this case" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate temp password
    const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Assign student role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "user",
    });

    // Create profile pre-filled from case data
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      phone_number: caseData.student_phone || null,
      city: caseData.selected_city || null,
      university_name: caseData.selected_school || null,
      must_change_password: true,
    });

    // Link student profile to case
    await supabaseAdmin.from("student_cases").update({
      student_profile_id: userId,
    }).eq("id", case_id);

    // Send credentials via email
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      await fetch(`${supabaseUrl}/functions/v1/send-branded-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email_type: "student_credentials",
          user_email: email,
          user_name: full_name,
          temp_password: tempPassword,
        }),
      });
    } catch (emailErr) {
      console.error("Failed to send credentials email:", emailErr);
    }

    // Audit log
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "create_student_account",
      target_id: userId,
      target_table: "profiles",
      details: `Created student account for ${email} (case: ${case_id})`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        message: `Student account created. Credentials sent to ${email}.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Create student account error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
