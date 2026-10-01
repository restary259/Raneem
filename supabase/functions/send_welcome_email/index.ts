import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req, ["admin", "team_member"]);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, full_name } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by email and create in-app notification
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Admins and internal service callers may welcome anyone. Team members may
    // only welcome students on a case currently assigned to them.
    const isAdmin = auth.isServiceRole || auth.roles.includes("admin");
    if (profile?.id && !isAdmin) {
      const { data: ownedCase, error: caseError } = await serviceClient
        .from("cases")
        .select("id")
        .eq("student_user_id", profile.id)
        .eq("assigned_to", auth.userId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (caseError) throw caseError;
      if (!ownedCase) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (profile?.id) {
      await serviceClient.from("notifications").insert({
        user_id: profile.id,
        title: "Welcome to Darb Study!",
        body: `Welcome, ${full_name || "Student"}! Your account was created successfully.`,
        source: "welcome",
        metadata: {},
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return serverErrorResponse(err, corsHeaders, "Failed to send welcome email");
  }
});
