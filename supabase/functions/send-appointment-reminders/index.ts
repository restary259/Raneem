// Sends due appointment reminders (24h and 1h before the appointment).
// Invoked by pg_cron every 5 minutes. Idempotent: each reminder row is stamped
// with sent_at once processed, so re-runs never duplicate a reminder.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * Non-secret fingerprint (first 8 hex chars of SHA-256) of the service-role
 * key, for comparing secrets across functions. Never expose the key itself.
 */
async function serviceKeyFingerprint(): Promise<string | undefined> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key) return undefined;
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex.slice(0, 8);
  } catch {
    return undefined;
  }
}

/**
 * Send the reminder email via raw fetch with the explicit service-role bearer
 * token, matching the other send-transactional-email callers. Uses raw fetch()
 * rather than admin.functions.invoke() because the Supabase JS FunctionsClient
 * can strip/override the Authorization header on nested function-to-function
 * calls. fetch() does NOT throw on a non-2xx response, so response.ok must be
 * inspected explicitly.
 */
async function sendReminderEmail(
  recipientEmail: string,
  reminderId: string,
  templateData: Record<string, unknown>,
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[appointment-reminder] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", {
      service_key_present: !!serviceKey,
    });
    return false;
  }
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: "appointment-reminder",
        recipientEmail,
        idempotencyKey: `appt-reminder-${reminderId}`,
        templateData,
      }),
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      console.warn(
        "[appointment-reminder email failed]",
        JSON.stringify({
          downstream: "send-transactional-email",
          status: response.status,
          auth_mode: "service_role",
          service_key_present: !!serviceKey,
          service_key_fingerprint: await serviceKeyFingerprint(),
          detail: text,
        }),
      );
      return false;
    }
    let body: Record<string, unknown> | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON success body is fine
    }
    if (body && body.success === false) {
      console.warn(`[appointment-reminder email not sent] reason=${String(body.reason)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[appointment-reminder email failed]", e);
    return false;
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Only the cron caller (service role) or an admin may fan out reminders:
  // this endpoint writes notifications and sends mail for other users.
  const auth = await requireAuth(req, ["admin"]);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { data: due, error } = await admin
      .from("appointment_reminders")
      .select("id, appointment_id, recipient_id, kind, due_at")
      .is("sent_at", null)
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!due?.length) return json({ ok: true, sent: 0 });

    let sent = 0;

    for (const reminder of due) {
      const { data: appt } = await admin
        .from("appointments")
        .select("id, scheduled_at, notes, outcome, rescheduled_to, guest_name, case_id")
        .eq("id", reminder.appointment_id)
        .maybeSingle();

      // Cancelled, completed or moved appointments no longer need a reminder.
      if (!appt || appt.outcome || appt.rescheduled_to) {
        await admin
          .from("appointment_reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        continue;
      }

      let studentName = appt.guest_name ?? "";
      let caseReference = "";
      if (appt.case_id) {
        const { data: c } = await admin
          .from("cases")
          .select("full_name, case_reference")
          .eq("id", appt.case_id)
          .maybeSingle();
        studentName = c?.full_name ?? studentName;
        caseReference = c?.case_reference ?? "";
      }

      const when = new Date(appt.scheduled_at);
      const whenText = when.toISOString().slice(0, 16).replace("T", " ");
      const isOneHour = reminder.kind === "t_1h";
      const label = studentName || caseReference || whenText;

      // In-app notification; the notifications trigger fans this out to push.
      // Idempotent via _dedupe_key, so a retry that only needs the email will
      // not create a duplicate in-app notification.
      const { error: notifyError } = await admin.rpc("emit_notification", {
        _user_id: reminder.recipient_id,
        _actor_id: null,
        _source: "appointment",
        _title_en: isOneHour ? "Appointment in 1 hour" : "Appointment tomorrow",
        _title_ar: isOneHour ? "موعدك بعد ساعة" : "لديك موعد غداً",
        _body_en: `${label} — ${whenText}`,
        _body_ar: `${label} — ${whenText}`,
        _case_id: appt.case_id,
        _link: "/team/appointments",
        _dedupe_key: `appt-reminder-${reminder.id}`,
      });
      if (notifyError) {
        console.warn("[appointment-reminder] in-app notification failed", notifyError.message);
      }

      // Best-effort email; never blocks the in-app/push reminder. The reminder
      // is only marked sent_at once the in-app notification succeeded AND the
      // email path succeeded (or there was no email to send), so a downstream
      // 401/500 leaves sent_at NULL and the cron retries on the next run.
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", reminder.recipient_id)
        .maybeSingle();

      let emailSent = true; // no email to send => treat as success
      if (profile?.email) {
        emailSent = await sendReminderEmail(profile.email, reminder.id, {
          recipientName: profile.full_name ?? "",
          studentName,
          caseReference,
          whenText,
          windowLabel: isOneHour ? "1h" : "24h",
          notes: appt.notes ?? "",
          link: "https://darb.agency/team/appointments",
        });
      }

      // Only stamp sent_at once the reminder was actually delivered. A failed
      // email or in-app notification must not be marked "sent", or the cron
      // would never retry it.
      if (notifyError || !emailSent) {
        console.warn(
          `[appointment-reminder not marked sent] reminder=${reminder.id} notify_ok=${!notifyError} email_ok=${emailSent}`,
        );
        continue;
      }

      await admin
        .from("appointment_reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);
      sent++;
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-appointment-reminders error:", e);
    return json({ error: "Server error" }, 500);
  }
});
