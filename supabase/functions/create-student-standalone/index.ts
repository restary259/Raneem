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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate caller
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).in("role", ["admin", "team_member"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Team member or admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, full_name, case_id, created_by } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if already registered via profiles table (faster than listUsers)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({ error: "An account with this email already exists" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate secure temporary password: 8 alphanum + symbols
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const specials = "!@#$%";
    const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
    const tempPassword =
      rand("ABCDEFGHJKMNPQRSTUVWXYZ") +
      rand("abcdefghjkmnpqrstuvwxyz") +
      rand("23456789") +
      rand(specials) +
      Array.from({ length: 8 }, () => rand(chars)).join("");

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name?.trim() || "",
        must_change_password: true,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newUser.user.id;

    // Assign student role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "student" },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );

    // Create profile — prefill from case data if case_id provided
    let caseCity: string | null = null;
    let casePhone: string | null = null;
    if (case_id) {
      const { data: caseRow } = await supabaseAdmin
        .from("cases")
        .select("city, phone_number, education_level, degree_interest, intake_notes")
        .eq("id", case_id)
        .maybeSingle();
      if (caseRow) {
        caseCity = caseRow.city ?? null;
        casePhone = caseRow.phone_number ?? null;
      }
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: full_name?.trim() || "",
      must_change_password: true,
      created_by: created_by ?? callerId,
      city: caseCity,
      phone_number: casePhone,
    });

    // If case_id provided, link student to case
    if (case_id) {
      await supabaseAdmin
        .from("cases")
        .update({ student_user_id: userId })
        .eq("id", case_id);
    }

    // Audit log
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: callerId,
      action: "create_student_standalone",
      target_id: userId,
      target_table: "profiles",
      details: `Created standalone student account for ${cleanEmail}${case_id ? ` (case: ${case_id})` : ""}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email: cleanEmail,
        full_name: full_name?.trim() || "",
        temp_password: tempPassword,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-student-standalone error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
