// Managed app-email send + app-side send log.
//
// Every feature function sends through this wrapper so the project's own
// `email_send_log` audit table keeps receiving the same rows it did before
// (status: 'sent' | 'suppressed' | 'failed'). Delivery, retries, rate limits,
// suppression and unsubscribe are handled by Lovable's managed email API.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendTemplateEmail,
  type SendTemplateEmailResult,
} from "./transactional-email-templates/send-email.ts";

function logClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function writeLog(row: Record<string, unknown>): Promise<void> {
  const supabase = logClient();
  if (!supabase) return;
  const { error } = await supabase.from("email_send_log").insert(row);
  if (error) {
    // A log row never decides the send result — record and continue.
    console.error("email_send_log insert failed", { code: error.code, message: error.message });
  }
}

export interface SendAppEmailOptions {
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
  replyTo?: string;
}

/**
 * Sends a registered app-email template and mirrors the outcome into
 * `email_send_log`. Never throws: callers get a boolean-ish result.
 */
export async function sendAppEmail(
  templateName: string,
  recipientEmail: string,
  options: SendAppEmailOptions = {},
): Promise<{ ok: boolean; suppressed?: boolean; detail?: string }> {
  const base = {
    template_name: templateName,
    recipient_email: recipientEmail,
    category: "transactional",
  };

  let result: SendTemplateEmailResult;
  try {
    result = await sendTemplateEmail(templateName, recipientEmail, {
      templateData: options.templateData as Record<string, any> | undefined,
      idempotencyKey: options.idempotencyKey,
      replyTo: options.replyTo,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("app email send failed", { templateName, detail });
    await writeLog({ ...base, status: "failed", error_message: detail.slice(0, 500) });
    return { ok: false, detail };
  }

  if (!result.sent) {
    await writeLog({
      ...base,
      status: "suppressed",
      error_message: "Recipient is suppressed (bounce, complaint or unsubscribe)",
    });
    return { ok: false, suppressed: true, detail: "recipient_suppressed" };
  }

  await writeLog({ ...base, status: "sent" });
  return { ok: true };
}
