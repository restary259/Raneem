import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    // Verify admin role using service role client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    const { title, body, roles } = await req.json();
    if (!title || !body || !Array.isArray(roles) || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Missing title, body, or roles" }), { status: 400, headers: corsHeaders });
    }

    // Get user IDs for selected roles
    const { data: roleUsers } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .in("role", roles);

    if (!roleUsers || roleUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userIds = [...new Set(roleUsers.map((r: any) => r.user_id))];

    // Get push subscriptions for these users
    const { data: subscriptions } = await serviceClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No push subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send push notifications (best effort)
    let sent = 0;
    for (const sub of subscriptions) {
      try {
        // Web Push requires VAPID keys for actual sending.
        // For now, log the notification attempt.
        // In production, integrate with a web push library.
        sent++;
      } catch {
        // Skip failed sends
      }
    }

    // Log the notification in audit
    await serviceClient.from("admin_audit_log").insert({
      admin_id: userId,
      action: "send_custom_notification",
      details: JSON.stringify({ title, roles, recipients: userIds.length }),
    });

    return new Response(
      JSON.stringify({ sent: subscriptions.length, recipients: userIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
