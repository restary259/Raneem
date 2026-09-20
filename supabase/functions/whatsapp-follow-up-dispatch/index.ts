import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { isCronDispatcher } from "../_shared/cronAuth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";

const cors = (req: Request) => buildCorsHeaders(req);

function json(body: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const cron = await isCronDispatcher(req);
    if (!cron) {
      const auth = await requireAuth(req, ["admin"]);
      if (!auth.ok) return json({ error: auth.error }, auth.status, headers);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: tasks, error: claimError } = await admin.rpc("whatsapp_claim_due_follow_up_tasks", { p_limit: 25 });
    if (claimError) throw claimError;

    let processed = 0;
    let sent = 0;
    let resumed = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const task of (tasks ?? []) as Array<{
      id: string;
      conversation_id: string;
      kind: string;
      template_id: string | null;
      template_parameters: unknown;
      attempt_count: number;
      max_attempts: number;
    }>) {
      processed += 1;
      try {
        if (task.kind === "snooze_resume") {
          const { data: conversation, error } = await admin
            .from("whatsapp_conversations")
            .select("id,state,snoozed_until")
            .eq("id", task.conversation_id)
            .maybeSingle();

          if (error) throw error;

          if (conversation?.state === "snoozed" && conversation.snoozed_until && new Date(conversation.snoozed_until).getTime() <= Date.now()) {
            const { error: resumeError } = await admin
              .from("whatsapp_conversations")
              .update({ state: "waiting_for_team", snoozed_until: null, updated_at: new Date().toISOString() })
              .eq("id", task.conversation_id)
              .eq("state", "snoozed");
            if (resumeError) throw resumeError;
            resumed += 1;
          }

          await admin.rpc("whatsapp_complete_follow_up_task", {
            p_task_id: task.id,
            p_status: "sent",
            p_error: null,
          });
          results.push({ id: task.id, kind: task.kind, result: "processed" });
          continue;
        }

        if (task.kind !== "template" || !task.template_id) {
          throw new Error("Invalid WhatsApp follow-up task");
        }

        const parameters = Array.isArray(task.template_parameters) ? task.template_parameters : [];
        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-connector`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
            "Lovable-Context": "whatsapp-follow-up",
          },
          body: JSON.stringify({
            action: "send",
            conversation_id: task.conversation_id,
            template_id: task.template_id,
            parameters,
          }),
        });

        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(`WhatsApp connector returned ${response.status}: ${bodyText.slice(0, 500)}`);
        }

        await admin.rpc("whatsapp_complete_follow_up_task", {
          p_task_id: task.id,
          p_status: "sent",
          p_error: null,
        });
        sent += 1;
        results.push({ id: task.id, kind: task.kind, result: "sent" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown follow-up error";
        failed += 1;
        const terminal = task.attempt_count >= task.max_attempts;
        await admin.rpc("whatsapp_complete_follow_up_task", {
          p_task_id: task.id,
          p_status: terminal ? "failed" : "pending",
          p_error: message,
        }).catch(() => undefined);
        results.push({ id: task.id, kind: task.kind, result: terminal ? "failed" : "retrying", error: message });
      }
    }

    return json({ processed, sent, resumed, failed, results }, 200, headers);
  } catch (error) {
    return serverErrorResponse(error, headers, "WhatsApp follow-up dispatch failed");
  }
});
