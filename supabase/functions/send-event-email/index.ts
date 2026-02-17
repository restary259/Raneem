import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISA_EMAIL_TEMPLATES: Record<string, { subject: string; body: (name: string) => string }> = {
  applied: {
    subject: "Your Visa Application Has Been Submitted – Darb Agency",
    body: (name) => `Dear ${name},\n\nWe are pleased to inform you that your visa application has been submitted.\n\nOur team is monitoring the process and will keep you updated on any changes.\n\nBest regards,\nDarb Agency Team`,
  },
  approved: {
    subject: "Congratulations! Your Visa Has Been Approved – Darb Agency",
    body: (name) => `Dear ${name},\n\nGreat news! Your visa has been approved.\n\nPlease check your student dashboard for next steps regarding your arrival in Germany.\n\nBest regards,\nDarb Agency Team`,
  },
  rejected: {
    subject: "Visa Application Update – Darb Agency",
    body: (name) => `Dear ${name},\n\nUnfortunately, your visa application was not approved at this time.\n\nPlease contact our team to discuss next steps and possible reapplication.\n\nBest regards,\nDarb Agency Team`,
  },
  received: {
    subject: "Your Visa Has Been Received – Darb Agency",
    body: (name) => `Dear ${name},\n\nYour visa has been received and is ready for collection.\n\nPlease check your dashboard for further instructions.\n\nBest regards,\nDarb Agency Team`,
  },
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

    const body = await req.json();

    // Handle visa_status_changed event from trigger
    if (body.event === "visa_status_changed") {
      const { student_email, student_name, new_status } = body;

      if (!student_email || !new_status) {
        return new Response(JSON.stringify({ error: "Missing student_email or new_status" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const template = VISA_EMAIL_TEMPLATES[new_status];
      if (template) {
        // Send email via Supabase Auth's email service (or log for now)
        console.log(`[VISA EMAIL] To: ${student_email}, Subject: ${template.subject}`);
        console.log(`[VISA EMAIL] Body: ${template.body(student_name || "Student")}`);
        
        // Try sending via the send-email function if available
        try {
          const emailRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: student_email,
                subject: template.subject,
                text: template.body(student_name || "Student"),
              }),
            }
          );
          console.log("[VISA EMAIL] send-email response:", emailRes.status);
        } catch (emailErr) {
          console.error("[VISA EMAIL] Failed to call send-email:", emailErr);
        }
      }

      return new Response(JSON.stringify({ success: true, event: "visa_status_changed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Original event handling
    const { event_type, user_id, metadata } = body;

    if (!event_type || !user_id) {
      return new Response(JSON.stringify({ error: "Missing event_type or user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      default:
        return new Response(JSON.stringify({ error: "Unknown event_type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
