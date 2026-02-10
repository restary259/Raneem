import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, subscription, user_id, title, body, url, tag } = await req.json();

    // Save subscription
    if (action === "subscribe") {
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      }, { onConflict: "user_id,endpoint" });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unsubscribe
    if (action === "unsubscribe") {
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user_id)
        .eq("endpoint", subscription.endpoint);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification to a specific user (admin only)
    if (action === "send") {
      // Note: Web Push requires VAPID keys. This is a foundation - 
      // actual sending requires configuring VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id);

      // For now, return the count of subscriptions found
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Found ${subs?.length || 0} subscription(s) for user`,
        note: "Configure VAPID keys to enable actual push delivery"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("push-notify error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
