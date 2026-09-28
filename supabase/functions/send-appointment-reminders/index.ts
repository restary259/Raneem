// Sends due appointment reminders to the assigned team member:
//   24h before  -> normal,        in-app + push + email
//   1h before   -> important,     in-app + push + email
//   15m before  -> time-sensitive, in-app + push (no email)
//
// Invoked by pg_cron every 5 minutes. The push leg and the email leg are
// tracked and retried INDEPENDENTLY (`push_sent_at` / `email_sent_at`), so a
// failed email can never re-send an already-delivered push — the 15-minute
// alert must never appear twice.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { isCronDispatcher } from "../_shared/cronAuth.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";
import {
  buildReminderContent,
  type ReminderKind,
} from "../_shared/appointmentReminder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    // Idempotency key is scoped to the reminder row, so a retry that only
    // needed the email never double-sends it.
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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: due, error } = await admin
      .from("appointment_reminders")
      .select("id, appointment_id, recipient_id, kind, due_at, push_sent_at, email_sent_at")
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
        .select("id, scheduled_at, duration_minutes, notes, outcome, rescheduled_to, guest_name, case_id, office_id")
        .eq("id", reminder.appointment_id)
        .maybeSingle();

      // Cancelled, completed or moved appointments no longer need a reminder.
      if (!appt || appt.outcome || appt.rescheduled_to) {
        const now = new Date().toISOString();
        await admin
          .from("appointment_reminders")
          .update({ sent_at: now, push_sent_at: now, email_sent_at: now })
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

      let officeName = "";
      if (appt.office_id) {
        const { data: office } = await admin
          .from("offices")
          .select("name_en, name_ar")
          .eq("id", appt.office_id)
          .maybeSingle();
        officeName = office?.name_en ?? office?.name_ar ?? "";
      }

      const content = buildReminderContent(reminder.kind as ReminderKind, {
        id: appt.id,
        scheduledAt: appt.scheduled_at,
        durationMinutes: appt.duration_minutes,
        studentName,
        caseReference,
        officeName,
      });

      const patch: Record<string, string | null> = {};

      // ── Push leg (in-app notification + fan-out to push) ────────────────
      // Idempotent via _dedupe_key, and skipped entirely once this reminder
      // has already been pushed, so a later email retry never re-pushes.
      if (!reminder.push_sent_at) {
        const args = {
          _user_id: reminder.recipient_id,
          _actor_id: null,
          _source: "appointment",
          _title_en: content.titleEn,
          _title_ar: content.titleAr,
          _body_en: content.bodyEn,
          _body_ar: content.bodyAr,
          _case_id: appt.case_id,
          _link: content.link,
          _dedupe_key: `appt-reminder-${reminder.id}`,
          _priority: content.priority,
        };
        // The migration DROPs the 10-argument emit_notification and creates a
        // single 11-argument one (an overload would make a 10-arg call
        // ambiguous — PGRST203). Until that manual migration is applied, the
        // 11-argument signature does not exist yet, so fall back to the legacy
        // 10-argument call: the reminder still lands (as a normal alert) during
        // the deploy window instead of being lost.
        let { error: notifyError } = await admin.rpc("emit_notification", args);
        if (notifyError && /could not find the function|function .* does not exist|PGRST202/i.test(notifyError.message)) {
          const { _priority: _ignored, ...legacyArgs } = args;
          notifyError = (await admin.rpc("emit_notification", legacyArgs)).error;
        }
        if (notifyError) {
          console.warn("[appointment-reminder] in-app notification failed", notifyError.message);
          patch.push_sent_at = null;
        } else {
          patch.push_sent_at = new Date().toISOString();
        }
      } else {
        patch.push_sent_at = reminder.push_sent_at;
      }

      // ── Email leg (24h / 1h only) ───────────────────────────────────────
      patch.email_sent_at = reminder.email_sent_at ?? null;
      if (content.email && !reminder.email_sent_at) {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", reminder.recipient_id)
          .maybeSingle();

        // No email on file is not a failure — mark it done so the row settles.
        let emailSent = true;
        if (profile?.email) {
          emailSent = await sendReminderEmail(profile.email, reminder.id, {
            recipientName: profile.full_name ?? "",
            studentName,
            caseReference,
            whenText: new Date(appt.scheduled_at).toISOString().slice(0, 16).replace("T", " "),
            windowLabel: reminder.kind === "t_1h" ? "1h" : "24h",
            notes: appt.notes ?? "",
            link: `https://darb.agency${content.link}`,
          });
        }
        if (emailSent) patch.email_sent_at = new Date().toISOString();
      }

      // Push is always required; email is required only for the 24h/1h windows.
      const pushDone = Boolean(patch.push_sent_at);
      const emailDone = !content.email || Boolean(patch.email_sent_at);
      const fullyDone = pushDone && emailDone;

      if (fullyDone) patch.sent_at = new Date().toISOString();
      else {
        console.warn(
          `[appointment-reminder partially delivered] reminder=${reminder.id} push_ok=${pushDone} email_ok=${emailDone}`,
        );
      }

      await admin.from("appointment_reminders").update(patch).eq("id", reminder.id);
      if (fullyDone) sent++;
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-appointment-reminders error:", e);
    return json({ error: "Server error" }, 500);
  }
});
