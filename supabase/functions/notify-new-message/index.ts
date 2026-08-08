import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireAuth } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const BodySchema = z.object({
  thread_type: z.enum(["case", "direct"]),
  thread_id: z.string().uuid(),
  preview: z.string().max(300).optional().default(""),
});

/** Debounce window: one email per recipient per thread per 10 minutes. */
const DEBOUNCE_MS = 10 * 60 * 1000;
const lastSent = new Map<string, number>();

async function sendEmail(to: string, subject: string, text: string, link: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.log(`[chat-email skipped: no provider] to=${to} subject=${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Darb Agency <notifications@darb.agency>",
      to: [to],
      subject,
      html: `<div dir="auto" style="font-family:system-ui,sans-serif;line-height:1.6">
        <p>${text}</p>
        <p><a href="${link}">${link}</a></p>
        <p style="color:#888;font-size:12px">Darb Agency</p>
      </div>`,
    }),
  });
  if (!res.ok) console.error("[chat-email failed]", res.status, await res.text());
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
  const { thread_type, thread_id, preview } = parsed.data;
  const senderId = auth.userId;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Recipients
    let recipientIds: string[] = [];
    let subject = "New message — Darb Agency";
    let link = "https://darb-agency.lovable.app/team/messages";

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
        .select("assigned_to, student_user_id")
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
      subject = "New message on your case — Darb Agency";
      link = `https://darb-agency.lovable.app/team/cases/${thread_id}`;
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      await sendEmail(
        p.email,
        subject,
        `${p.full_name ?? ""}${p.full_name ? ", " : ""}you have a new message on Darb Agency${
          preview ? `: “${preview}”` : "."
        }`,
        link,
      );
      sent += 1;
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
