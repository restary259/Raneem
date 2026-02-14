import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { event_type, user_id, metadata } = await req.json();

    if (!event_type || !user_id) {
      return new Response(JSON.stringify({ error: "Missing event_type or user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "User profile or email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine email type for the branded email function
    let emailPayload: Record<string, any> = {
      user_email: profile.email,
      user_name: profile.full_name,
    };

    switch (event_type) {
      case "welcome":
        emailPayload.email_type = "welcome";
        break;

      case "status_change":
        emailPayload.email_type = "status_change";
        emailPayload.new_status = metadata?.new_status || "unknown";
        emailPayload.old_status = metadata?.old_status || "unknown";
        break;

      case "referral_accepted":
        emailPayload.email_type = "referral_accepted";
        emailPayload.referred_name = metadata?.referred_name || "";
        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown event_type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Call the send-branded-email function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-branded-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const emailResult = await emailRes.json();

    // Also create an in-app notification
    let notifTitle = "";
    let notifBody = "";

    switch (event_type) {
      case "welcome":
        notifTitle = "Welcome to Darb!";
        notifBody = "Your account has been set up. Start exploring your dashboard.";
        break;
      case "status_change":
        notifTitle = "Application Status Updated";
        notifBody = `Your application status changed to: ${metadata?.new_status || "updated"}`;
        break;
      case "referral_accepted":
        notifTitle = "Referral Accepted!";
        notifBody = `Your referral for ${metadata?.referred_name || "a friend"} has been accepted.`;
        break;
    }

    if (notifTitle) {
      await serviceClient.from("notifications").insert({
        user_id,
        title: notifTitle,
        body: notifBody,
        source: event_type,
        metadata: metadata || {},
      });
    }

    return new Response(JSON.stringify({ success: true, emailResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
