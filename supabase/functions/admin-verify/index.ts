
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody, shortText, longText } from "../_shared/validate.ts";


serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", isAdmin: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token", isAdmin: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Check admin role server-side using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: roles, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");

    if (roleError) {
      console.error("Admin role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Unable to verify permissions", isAdmin: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = (roles?.length ?? 0) > 0;

    // Log admin access attempt (best effort — never fail the isAdmin answer
    // because audit logging broke, and only store validated fields).
    if (isAdmin) {
      try {
        const parsed = await parseBody(
          req,
          z.object({
            action: shortText.optional(),
            target_table: shortText.optional(),
            target_id: shortText.optional(),
            details: longText.optional(),
          }),
        );

        const action = parsed.ok ? parsed.data.action : undefined;

        if (action) {
          const { error: auditError } = await supabaseAdmin.from("admin_audit_log").insert({
            admin_id: userId,
            action,
            target_table: parsed.data.target_table ?? null,
            target_id: parsed.data.target_id ?? null,
            details: parsed.data.details ?? null,
          });

          if (auditError) {
            console.error("Admin audit log failed:", auditError);
          }
        }
      } catch (auditError) {
        console.error("Admin audit log exception:", auditError);
      }
    }

    return new Response(JSON.stringify({ isAdmin, userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Admin verify error:", e);
    return new Response(JSON.stringify({ error: "Server error", isAdmin: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
