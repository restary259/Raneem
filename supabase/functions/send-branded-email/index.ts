import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_type, user_email, user_name, ...metadata } = await req.json();

    // This function now only creates in-app notifications.
    // Auth emails (confirmation, password reset, magic link) are handled natively.
    // Credential emails are shown directly in the admin UI.

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For notification types, find user_id by email
    let userId: string | null = null;
    if (user_email) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", user_email)
        .maybeSingle();
      userId = profile?.id || null;
    }

    let notifTitle = "";
    let notifBody = "";

    switch (email_type) {
      case "welcome":
        notifTitle = "مرحباً بك في درب للدراسة!";
        notifBody = `أهلاً ${user_name || ""}، تم إنشاء حسابك بنجاح.`;
        break;
      case "status_change":
        notifTitle = "تحديث حالة الطلب";
        notifBody = `تم تغيير حالة طلبك إلى: ${metadata.new_status || "محدّث"}`;
        break;
      case "referral_accepted":
        notifTitle = "تم قبول الإحالة!";
        notifBody = `تم قبول إحالتك لـ ${metadata.referred_name || "صديق"}.`;
        break;
      case "weekly_digest":
        notifTitle = "التقرير الأسبوعي";
        notifBody = "تقرير الأسبوع متاح الآن في لوحة التحكم.";
        break;
      default:
        // For credential types or unknown types, just return success
        return new Response(
          JSON.stringify({ success: true, message: "No email action needed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (userId && notifTitle) {
      await serviceClient.from("notifications").insert({
        user_id: userId,
        title: notifTitle,
        body: notifBody,
        source: email_type,
        metadata: metadata || {},
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-branded-email error:", err);
    return new Response(
      JSON.stringify({ error: err.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
