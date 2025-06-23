
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  user_ids: string[];
  type: string;
  category: string;
  reference_id?: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
  channel?: {
    inApp: boolean;
    push: boolean;
    email: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      user_ids,
      type,
      category,
      reference_id,
      title,
      message,
      url,
      data,
      channel = { inApp: true, push: false, email: false }
    }: NotificationRequest = await req.json();

    // Validate required fields
    if (!user_ids || !type || !category || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create notifications for all users
    const notifications = user_ids.map(user_id => ({
      user_id,
      type,
      category,
      reference_id,
      title,
      message,
      url,
      data,
      channel,
    }));

    const { data: insertedNotifications, error } = await supabase
      .from("notifications")
      .insert(notifications)
      .select();

    if (error) throw error;

    // Handle push notifications if enabled
    if (channel.push) {
      // Get users' push tokens
      const { data: settings } = await supabase
        .from("notification_settings")
        .select("user_id, push_token, channels")
        .in("user_id", user_ids)
        .not("push_token", "is", null);

      if (settings && settings.length > 0) {
        for (const setting of settings) {
          if (setting.channels?.push && setting.push_token) {
            // Here you would integrate with FCM or OneSignal
            console.log(`Would send push notification to token: ${setting.push_token}`);
            // TODO: Implement actual push notification sending
          }
        }
      }
    }

    // Handle email notifications if enabled
    if (channel.email) {
      const { data: settings } = await supabase
        .from("notification_settings")
        .select("user_id, channels")
        .in("user_id", user_ids);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", user_ids);

      if (settings && profiles) {
        for (const profile of profiles) {
          const userSettings = settings.find(s => s.user_id === profile.id);
          if (userSettings?.channels?.email) {
            // Here you would send email via Resend
            console.log(`Would send email to: ${profile.email}`);
            // TODO: Implement actual email sending
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications: insertedNotifications 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
