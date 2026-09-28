// Sends due appointment reminders (24h and 1h before the appointment).
// Invoked by pg_cron every 5 minutes. Idempotent: each reminder row is stamped
// with sent_at once processed, so re-runs never duplicate a reminder.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { isCronDispatcher } from "../_shared/cronAuth.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

/**
 * Send the reminder email through Lovable's managed email API.
 */
async function sendReminderEmail(
  recipientEmail: string,
  reminderId: string,
  templateData: Record<string, unknown>,
): Promise<boolean> {
  const result = await sendAppEmail("appointment-reminder", recipientEmail, {
    templateData,
    idempotencyKey: `appt-reminder-${reminderId}`,
  });
  if (!result.ok) {
    console.warn("[appointment-reminder email not sent]", {
      reason: result.suppressed ? "recipient_suppressed" : result.detail,
    });
    return false;
  }
  return true;
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
  if (!(await isCronDispatcher(req))) {
    const auth = await requireAuth(req, ["admin"]);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { data: due, error } = await admin
      .from("appointment_reminders")
      .select("id, appointment_id, recipient_id, kind, due_at, push_sent_at, email_sent_at, attempts")
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
      // Show the office's local time (Israel), not UTC.
      const whenText = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jerusalem", dateStyle: "medium", timeStyle: "short",
      }).format(when);
      const kind = reminder.kind as "t_24h" | "t_1h" | "t_15m";
      const label = studentName || caseReference || whenText;

      // Staleness guard: never send a reminder after the meeting started, and
      // drop 24h/1h reminders that are more than half their window late.
      const nowMs = Date.now();
      const lateMs = nowMs - new Date(reminder.due_at).getTime();
      const halfWindow = { t_24h: 12 * 3600e3, t_1h: 30 * 60e3, t_15m: Infinity }[kind] ?? Infinity;
      const attempts = ((reminder as { attempts?: number }).attempts ?? 0) + 1;
      if (when.getTime() <= nowMs || lateMs > halfWindow || attempts > 5) {
        console.warn(`[appointment-reminder closed] reminder=${reminder.id} kind=${kind} late_ms=${lateMs} attempts=${attempts}`);
        await admin.from("appointment_reminders")
          .update({ sent_at: new Date().toISOString(), attempts })
          .eq("id", reminder.id);
        continue;
      }
      await admin.from("appointment_reminders").update({ attempts }).eq("id", reminder.id);
      const copy = {
        t_24h: { en: "Appointment tomorrow", ar: "لديك موعد غداً", priority: "medium", window: "24h" },
        t_1h: { en: "Appointment in 1 hour", ar: "موعدك بعد ساعة", priority: "high", window: "1h" },
        t_15m: { en: "Appointment starting soon", ar: "موعدك يبدأ بعد 15 دقيقة", priority: "high", window: "15m" },
      }[kind] ?? { en: "Appointment reminder", ar: "تذكير بموعد", priority: "medium", window: "24h" };
      const link = `/team/appointments?appointment=${appt.id}`;
      const now = () => new Date().toISOString();
      const body = `${label} — ${whenText}`;

      // Push/in-app channel, tracked separately from email so an email failure
      // can never trigger a second push. Idempotent via the unique dedupe_key.
      // NOTE: iOS Home Screen web apps only honour standard Web Push; there is
      // no "time-sensitive" interruption level for PWAs, so priority=high maps
      // to push Urgency: high instead. Do not add a fake interruption-level.
      let pushOk = Boolean(reminder.push_sent_at);
      if (!pushOk) {
        const { error: notifyError } = await admin.from("notifications").insert({
          user_id: reminder.recipient_id,
          source: "appointment",
          category: "appointments",
          priority: copy.priority,
          title: copy.ar,
          body,
          title_en: copy.en,
          title_ar: copy.ar,
          body_en: body,
          body_ar: body,
          case_id: appt.case_id,
          link,
          metadata: { type: `appointment_${copy.window}`, appointment_id: appt.id },
          dedupe_key: `appt-reminder-${reminder.id}`,
        });
        if (notifyError && notifyError.code !== "23505") {
          console.warn("[appointment-reminder] notification failed", notifyError.message);
        } else {
          pushOk = true;
          await admin.from("appointment_reminders").update({ push_sent_at: now() }).eq("id", reminder.id);
        }
      }

      // Email channel: skipped for the 15-minute alert (too late to be useful).
      let emailOk = kind === "t_15m" || Boolean(reminder.email_sent_at);
      if (!emailOk) {
        const { data: profile } = await admin
          .from("profiles").select("email, full_name").eq("id", reminder.recipient_id).maybeSingle();
        emailOk = profile?.email
          ? await sendReminderEmail(profile.email, reminder.id, {
              recipientName: profile.full_name ?? "",
              studentName, caseReference, whenText,
              windowLabel: copy.window,
              notes: appt.notes ?? "",
              link: `https://darb.agency${link}`,
            })
          : true;
        if (emailOk) await admin.from("appointment_reminders").update({ email_sent_at: now() }).eq("id", reminder.id);
      }

      if (!pushOk || !emailOk) {
        console.warn(`[appointment-reminder partial] reminder=${reminder.id} push_ok=${pushOk} email_ok=${emailOk}`);
        continue;
      }
      await admin.from("appointment_reminders").update({ sent_at: now() }).eq("id", reminder.id);
      sent++;
    }


    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-appointment-reminders error:", e);
    return json({ error: "Server error" }, 500);
  }
});
