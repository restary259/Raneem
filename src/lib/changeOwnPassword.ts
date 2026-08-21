import { supabase } from "@/integrations/supabase/client";
import { readFunctionErrorBody } from "@/lib/functionError";

export class PasswordChangeError extends Error {
  code: string;

  constructor(message: string, code = "unknown") {
    super(message);
    this.name = "PasswordChangeError";
    this.code = code;
  }
}

/** The sole client entry point for changing the signed-in user's password. */
export async function changeOwnPassword(password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("change-own-password", {
    body: { password },
  });

  if (error) {
    const body = await readFunctionErrorBody(error);
    const message = typeof body?.error === "string" ? body.error : "Password update failed";
    const code = typeof body?.code === "string" ? body.code : "unknown";
    throw new PasswordChangeError(message, code);
  }
  if (data?.success !== true) {
    throw new PasswordChangeError("Password update could not be verified");
  }
}