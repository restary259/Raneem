import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireAuth } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BodySchema = z.object({
  thread_type: z.enum(["case", "direct"]).optional(),
  thread_id: z.string().uuid().optional(),
  preview: z.string().max(300).optional().default(""),
  /** Admin/staff-triggered delivery test: emails the caller only. */
  test: z.boolean().optional().default(false),
});

/** Debounce window: one email per recipient per thread per 10 minutes. */
const DEBOUNCE_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

const APP_URL = "https://darb.agency";

type Admin = ReturnType<typeof createClient>;

/**
 * Queue a branded email through Lovable Emails (send-transactional-email).
 *
 * Uses raw fetch() rather than admin.functions.invoke() because the
 * Supabase JS FunctionsClient can strip/override the Authorization header
 * on nested function-to-function calls (it injects the user session token,
 * and a service-role client has none). A raw fetch with an explicit
 * Authorization: Bearer <service-role-key> header guarantees the internal
 * call passes requireAuth's `token === serviceKey` fast-path in
 * send-transactional-email. This mirrors the working pattern in
 * approve-partner-recruit and send-event-email.
 */
async function sendTemplate(
  admin: Admin,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ ok: boolean; detail?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[chat-email] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return { ok: false, detail: "Server configuration error" };
  }
  let resp: Response;
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
    });
  } catch (err) {
    console.error(`[chat-email fetch failed] to=${recipientEmail} template=${templateName}`, err);
    return { ok: false, detail: String((err as Error)?.message ?? err) };
  }
  const text = await resp.text().catch(() => "");
  if (!resp.ok) {
    console.error(`[chat-email failed] to=${recipientEmail} template=${templateName} status=${resp.status}`, {
      downstream: "send-transactional-email",
      status: resp.status,
      auth_mode: "service_role",
      service_key_present: !!serviceKey,
      body: text,
    });
    return { ok: false, detail: text || `HTTP ${resp.status}` };
  }
  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON success body is fine */
  }
  if (body && body.success === false) {
    console.warn(`[chat-email not sent] to=${recipientEmail} reason=${body.reason}`);
    return { ok: false, detail: String(body.reason ?? "not_sent") };
  }
  console.log(`[chat-email queued] to=${recipientEmail} template=${templateName}`, {
    downstream: "send-transactional-email",
    status: 200,
    auth_mode: "service_role",
    service_key_present: !!serviceKey,
  });
  return { ok: true };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { thread_type, thread_id, preview, test } = parsed.data;
  const senderId = auth.userId;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // --- Delivery test: send only to the caller, no debounce, report errors ---
    if (test) {
      const { data: me } = await admin.from("profiles").select("email, full_name").eq("id", senderId).maybeSingle();
      if (!me?.email) {
        return new Response(JSON.stringify({ error: "No email on your profile" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await sendTemplate(
        admin,
        "email-test",
        me.email,
        { recipientName: me.full_name ?? "", sentAt: new Date().toISOString().slice(0, 16).replace("T", " ") },
        `email-test-${senderId}-${Date.now()}`,
      );
      return new Response(
        JSON.stringify({ ok: result.ok, sent: result.ok ? 1 : 0, to: me.email, detail: result.detail }),
        {
          status: result.ok ? 200 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!thread_type || !thread_id) {
      return new Response(JSON.stringify({ error: "thread_type and thread_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The caller must actually belong to the conversation. Without this any
    // signed-in user could email an arbitrary case's staff/student with
    // attacker-chosen preview text. Internal service-role callers are exempt.
    if (!auth.isServiceRole) {
      if (!senderId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: allowed, error: membershipError } = await admin.rpc(
        thread_type === "direct" ? "is_direct_thread_member" : "can_access_case_thread",
        thread_type === "direct"
          ? { _thread_id: thread_id, _user_id: senderId }
          : { _case_id: thread_id, _user_id: senderId },
      );
      if (membershipError || allowed !== true) {
        if (membershipError) console.error("[notify-new-message] membership check failed", membershipError.message);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Recipients
    let recipientIds: string[] = [];
    let threadTitle = "";
    let link = `${APP_URL}/team/messages`;

    if (thread_type === "direct") {
      const { data: participants } = await admin
        .from("direct_thread_participants")
        .select("user_id")
        .eq("thread_id", thread_id);
      recipientIds = (participants ?? [])
        .map((p: { user_id: string }) => p.user_id)
        .filter((id: string) => id !== senderId);
    } else {
      const { data: row } = await admin
        .from("cases")
        .select("assigned_to, student_user_id, case_reference")
        .eq("id", thread_id)
        .maybeSingle();
      if (!row) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientIds = [row.assigned_to, row.student_user_id].filter(
        (id: string | null): id is string => !!id && id !== senderId,
      );
      threadTitle = row.case_reference ?? "";
      link = `${APP_URL}/team/cases/${thread_id}`;
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sender display name
    const { data: sender } = await admin.from("profiles").select("full_name").eq("id", senderId).maybeSingle();

    // Muted threads
    const { data: mutes } = await admin
      .from("message_thread_mutes")
      .select("user_id")
      .eq("thread_type", thread_type)
      .eq("thread_id", thread_id);
    const muted = new Set((mutes ?? []).map((m: { user_id: string }) => m.user_id));

    // Preferences + addresses
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name, notify_email")
      .in("id", recipientIds);

    let sent = 0;
    const now = Date.now();
    for (const p of profiles ?? []) {
      if (muted.has(p.id) || p.notify_email === false || !p.email) continue;
      const key = `${p.id}:${thread_type}:${thread_id}`;
      const previousSend = lastSent.get(key) ?? 0;
      if (now - previousSend < DEBOUNCE_MS) continue;
      lastSent.set(key, now);
      const result = await sendTemplate(
        admin,
        "new-message",
        p.email,
        {
          recipientName: p.full_name ?? "",
          senderName: sender?.full_name ?? "",
          threadTitle,
          preview,
          link,
        },
        `chat-${thread_type}-${thread_id}-${p.id}-${Math.floor(now / DEBOUNCE_MS)}`,
      );
      if (result.ok) sent += 1;
      else lastSent.delete(key);
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-new-message]", err);
    return new Response(JSON.stringify({ error: "Failed to notify" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
