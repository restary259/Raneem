import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendWebPush, type PushSubscriptionRecord } from "../_shared/webpush.ts";
import { requireAuth } from "../_shared/auth.ts";

/**
 * Drains the `push_notifications` pgmq queue and delivers Web Push messages.
 *
 * Invoked by the database cron (`push_queue_dispatch`) right after a
 * notification row is inserted, so nothing in the app waits on delivery.
 */

const QUEUE = "push_notifications";
const BATCH_SIZE = 25;
const VISIBILITY_TIMEOUT = 60; // seconds a claimed message stays hidden
const MAX_ATTEMPTS = 3;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@darb.agency";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Preferences = Record<string, unknown> | null;

const CATEGORY_COLUMN: Record<string, string> = {
  messages: "cat_messages",
  appointments: "cat_appointments",
  cases: "cat_cases",
  payments: "cat_payments",
  documents: "cat_documents",
  profile: "cat_profile",
  recruitment: "cat_recruitment",
  system: "cat_system",
};

/** Minutes since midnight in the user's own timezone. */
function localMinutes(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    return -1;
  }
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
}

/** Quiet hours may wrap past midnight (e.g. 22:00 → 07:00). */
function inQuietHours(prefs: Preferences): boolean {
  if (!prefs) return false;
  const start = toMinutes((prefs.quiet_hours_start as string) ?? null);
  const end = toMinutes((prefs.quiet_hours_end as string) ?? null);
  if (start === null || end === null || start === end) return false;
  const now = localMinutes((prefs.timezone as string) ?? "Asia/Jerusalem");
  if (now < 0) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

interface DeliveryLogRow {
  notification_id: string | null;
  user_id: string;
  subscription_id: string | null;
  endpoint_hash: string | null;
  status_code: number | null;
  result: string;
  error_reason: string | null;
  attempt: number;
  sent_at: string | null;
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function processMessage(msg: { msg_id: number; read_ct: number; message: Record<string, unknown> }) {
  const notificationId = msg.message?.notification_id as string | undefined;
  const logs: DeliveryLogRow[] = [];
  if (!notificationId) return { drop: true, logs };

  const { data: notification, error: notifError } = await admin
    .from("notifications")
    .select("id, user_id, title, body, title_ar, body_ar, title_en, body_en, link, category, priority, case_id, source")
    .eq("id", notificationId)
    .maybeSingle();

  // The notification was deleted before we got to it — nothing to deliver.
  if (notifError || !notification) return { drop: true, logs };

  const userId = notification.user_id as string;
  const category = (notification.category as string) || "system";
  const priority = (notification.priority as string) || "medium";

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const categoryColumn = CATEGORY_COLUMN[category] ?? "cat_system";
  const pushEnabled = prefs ? prefs.push_enabled !== false : true;
  const categoryEnabled = prefs ? prefs[categoryColumn] !== false : true;

  const base = {
    notification_id: notificationId,
    user_id: userId,
    subscription_id: null,
    endpoint_hash: null,
    status_code: null,
    error_reason: null,
    attempt: msg.read_ct,
    sent_at: null,
  };

  if (!pushEnabled || !categoryEnabled) {
    logs.push({ ...base, result: "skipped_preferences" });
    return { drop: true, logs };
  }
  // High-priority alerts always break through quiet hours.
  if (priority !== "high" && inQuietHours(prefs as Preferences)) {
    logs.push({ ...base, result: "skipped_quiet_hours" });
    return { drop: true, logs };
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId)
    .eq("active", true);

  if (!subs || subs.length === 0) {
    logs.push({ ...base, result: "no_subscription" });
    return { drop: true, logs };
  }

  const payload = {
    title: notification.title_ar || notification.title,
    body: notification.body_ar || notification.body,
    url: notification.link || "/",
    tag: `${category}:${notification.case_id ?? notificationId}`,
    notificationId,
    category,
    priority,
  };

  let anyRetryable = false;

  await Promise.all(
    subs.map(async (sub) => {
      const record: PushSubscriptionRecord = {
        endpoint: sub.endpoint as string,
        p256dh: sub.p256dh as string,
        auth_key: sub.auth_key as string,
      };
      const result = await sendWebPush(
        record,
        payload,
        { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT },
        { ttl: priority === "high" ? 86400 : 3600, urgency: priority === "high" ? "high" : "normal" },
      );

      logs.push({
        ...base,
        subscription_id: sub.id as string,
        endpoint_hash: await hashEndpoint(record.endpoint),
        status_code: result.status || null,
        result: result.ok ? "sent" : result.gone ? "expired" : "failed",
        error_reason: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      });

      if (result.ok) {
        await admin
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), last_error_status: null })
          .eq("id", sub.id);
        return;
      }

      if (result.gone) {
        // 404/410 means the browser dropped the subscription for good.
        await admin
          .from("push_subscriptions")
          .update({
            active: false,
            revoked_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            last_error_status: result.status,
          })
          .eq("id", sub.id);
        return;
      }

      anyRetryable = true;
      await admin
        .from("push_subscriptions")
        .update({ last_error_at: new Date().toISOString(), last_error_status: result.status })
        .eq("id", sub.id);
    }),
  );

  // Retry transient push-service failures until the attempt budget is spent.
  return { drop: !anyRetryable || msg.read_ct >= MAX_ATTEMPTS, logs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // The queue holds notifications for every user, so only the cron caller
  // (service role) may drain it. A gateway-verified JWT is not enough: the
  // project's anon key is itself a valid JWT and is public.
  const auth = await requireAuth(req);
  if (!auth.ok || !auth.isServiceRole) {
    return new Response(
      JSON.stringify({ error: auth.ok ? "Forbidden" : auth.error }),
      {
        status: auth.ok ? 403 : auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("push-dispatch: VAPID keys are not configured");
    return new Response(JSON.stringify({ error: "push_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: batch, error } = await admin.rpc("read_email_batch", {
    queue_name: QUEUE,
    batch_size: BATCH_SIZE,
    vt: VISIBILITY_TIMEOUT,
  });

  if (error) {
    console.error("push-dispatch: failed to read queue", error.message);
    return new Response(JSON.stringify({ error: "queue_read_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages = (batch ?? []) as { msg_id: number; read_ct: number; message: Record<string, unknown> }[];
  const allLogs: DeliveryLogRow[] = [];
  let processed = 0;

  for (const msg of messages) {
    try {
      const { drop, logs } = await processMessage(msg);
      allLogs.push(...logs);
      if (drop) {
        await admin.rpc("delete_email", { queue_name: QUEUE, message_id: msg.msg_id });
      }
      processed++;
    } catch (e) {
      console.error("push-dispatch: message failed", msg.msg_id, (e as Error).message);
      if (msg.read_ct >= MAX_ATTEMPTS) {
        await admin.rpc("delete_email", { queue_name: QUEUE, message_id: msg.msg_id });
      }
    }
  }

  if (allLogs.length > 0) {
    const { error: logError } = await admin.from("push_delivery_log").insert(allLogs);
    if (logError) console.error("push-dispatch: log insert failed", logError.message);
  }

  return new Response(JSON.stringify({ processed, delivered: allLogs.filter((l) => l.result === "sent").length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
