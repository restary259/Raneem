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

const APP_URL = "https://darb-agency.lovable.app";

type Admin = ReturnType<typeof createClient>;

/** Queue a branded email through Lovable Emails (send-transactional-email). */
async function sendTemplate(
  admin: Admin,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ ok: boolean; detail?: string }> {
  const { data, error } = await admin.functions.invoke("send-transactional-email", {
    body: { templateName, recipientEmail, idempotencyKey, templateData },
  });
  if (error) {
    const detail =
      // deno-lint-ignore no-explicit-any
      (await (error as any)?.context?.text?.().catch(() => null)) ?? error.message;
    console.error(`[chat-email failed] to=${recipientEmail} template=${templateName}`, detail);
    return { ok: false, detail: String(detail) };
  }
  // deno-lint-ignore no-explicit-any
  const body = data as any;
  if (body && body.success === false) {
    console.warn(`[chat-email not sent] to=${recipientEmail} reason=${body.reason}`);
    return { ok: false, detail: String(body.reason ?? "not_sent") };
  }
  console.log(`[chat-email queued] to=${recipientEmail} template=${templateName}`);
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // --- Delivery test: send only to the caller, no debounce, report errors ---
    if (test) {
      const { data: me } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", senderId)
        .maybeSingle();
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
    const { data: sender } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", senderId)
      .maybeSingle();

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
