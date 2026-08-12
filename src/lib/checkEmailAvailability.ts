import { supabase } from "@/integrations/supabase/client";

/**
 * Result of the check-email-availability edge function.
 * `available` is false only when the email resolves to a real existing account
 * (profile/auth.users). A *pending* invitation with no account yet is NOT taken,
 * so a resend to a never-activated invitee still works.
 */
export interface EmailAvailabilityResult {
  available: boolean;
  existing_role: string | null;
  deactivated: boolean;
}

/**
 * Calls the check-email-availability edge function (admin/team_member only) and
 * returns whether `email` already belongs to any account. Throws on network/auth
 * errors so callers can fall back to permissive behavior in the catch.
 */
export async function checkEmailAvailability(
  email: string,
): Promise<EmailAvailabilityResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke("check-email-availability", {
    body: { email: email.trim().toLowerCase() },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (error || !data) {
    throw error ?? new Error("email-availability check failed");
  }

  return {
    available: Boolean((data as any).available),
    existing_role: (data as any).existing_role ?? null,
    deactivated: Boolean((data as any).deactivated),
  };
}
