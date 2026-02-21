
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
    const { email, password } = await req.json();

    // Input validation
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "البريد وكلمة المرور مطلوبان" }), {
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

    if (typeof password !== "string" || password.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Check rate limit: 5 failed attempts per email in 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: emailCount } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .eq("success", false)
      .gte("created_at", fifteenMinAgo);

    // IP-based rate limit: 20 failed attempts per IP in 15 minutes (prevents credential stuffing)
    const { count: ipCount } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("success", false)
      .gte("created_at", fifteenMinAgo);

    if ((emailCount ?? 0) >= 5) {
      return new Response(JSON.stringify({
        error: "تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة بعد 15 دقيقة.",
        locked: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((ipCount ?? 0) >= 20) {
      return new Response(JSON.stringify({
        error: "Too many login attempts from this network. Please try again in 15 minutes.",
        locked: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attempt login using a fresh client with anon key
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    // Log the attempt
    await supabaseAdmin.from("login_attempts").insert({
      email: email.toLowerCase(),
      ip_address: ip,
      success: !error,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "بيانات تسجيل الدخول غير صحيحة" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Single-session enforcement ---
    // Use a random session nonce as the identifier (stable across token refreshes)
    const sessionId = crypto.randomUUID();
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Check if there was an existing session (for audit logging)
    const { data: existingSession } = await supabaseAdmin
      .from("active_sessions")
      .select("session_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    // Upsert: replaces any previous session for this user
    await supabaseAdmin.from("active_sessions").upsert({
      user_id: data.user.id,
      session_id: sessionId,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Audit log if a previous session was replaced
    if (existingSession && existingSession.session_id !== sessionId) {
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: data.user.id,
        action: "SESSION_REPLACED",
        target_id: data.user.id,
        target_table: "active_sessions",
        details: `Previous session invalidated due to new login from IP: ${ip}`,
      });
    }

    return new Response(JSON.stringify({
      session: data.session,
      user: data.user,
      session_nonce: sessionId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Auth guard error:", e);
    return new Response(JSON.stringify({ error: "خطأ في الخادم" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
