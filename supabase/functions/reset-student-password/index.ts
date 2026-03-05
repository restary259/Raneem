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

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = userData.user.id;
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin");
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify target is a student
    const { data: targetRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user_id).eq("role", "student");
    if (!targetRoles?.length) {
      return new Response(JSON.stringify({ error: "Target user is not a student" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate new temp password
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const specials = "!@#$%";
    const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
    const tempPassword =
      rand("ABCDEFGHJKMNPQRSTUVWXYZ") +
      rand("abcdefghjkmnpqrstuvwxyz") +
      rand("23456789") +
      rand(specials) +
      Array.from({ length: 8 }, () => rand(chars)).join("");

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: tempPassword,
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Force password change on next login
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", user_id);

    // Audit log
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: callerId,
      action: "reset_student_password",
      target_id: user_id,
      target_table: "profiles",
      details: `Password reset for student ${user_id}`,
    });

    return new Response(
      JSON.stringify({ success: true, temp_password: tempPassword }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reset-student-password error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
