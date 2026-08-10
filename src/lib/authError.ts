import { AuthError } from "@supabase/supabase-js";

const FRIENDLY_BY_CODE: Record<string, string> = {
  weak_password: "Your new password is too weak. Please choose a stronger one.",
  same_password: "Your new password must be different from the old one.",
  invalid_credentials: "The email or password you entered is incorrect.",
  user_already_exists: "This email is already registered.",
  email_not_confirmed: "Please confirm your email address before signing in.",
  over_email_send_rate_limit: "Too many requests. Please wait a minute and try again.",
  over_request_rate_limit: "Too many requests. Please wait a moment and try again.",
  email_address_invalid: "Please enter a valid email address.",
  validation_failed: "Please check the information you entered and try again.",
  user_banned: "This account has been suspended.",
  session_not_found: "Your session has expired. Please sign in again.",
  session_expired: "Your session has expired. Please sign in again.",
  network_request_failed: "Connection problem. Please check your internet and try again.",
  unexpected_failure: "Something went wrong. Please try again.",
};

/**
 * Maps Supabase auth errors to user-friendly messages instead of leaking the
 * raw GoTrue text (e.g. "Password should be at least 6 characters", "Email rate
 * limit exceeded", or internal validation details) into the UI.
 *
 * Unknown errors fall back to a generic message; the raw error is still logged
 * to the console so real failures remain debuggable.
 */
export function friendlyAuthError(error: unknown): string {
  const code = error instanceof AuthError ? error.code : undefined;
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];

  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = raw.toLowerCase();

  if (/(weak password|too weak|at least \d+ characters|password.*short)/.test(lower)) {
    return "Your new password is too weak. Please choose a stronger one.";
  }
  if (/same.*password|different from the old/.test(lower)) {
    return "Your new password must be different from the old one.";
  }
  if (/rate limit|too many requests|try again after|60 seconds/.test(lower)) {
    return "Too many requests. Please wait a minute and try again.";
  }
  if (/already.*regist|already exists/.test(lower)) {
    return "This email is already registered.";
  }
  if (/invalid.*credential|incorrect.*password|wrong password|invalid login/.test(lower)) {
    return "The email or password you entered is incorrect.";
  }
  if (/confirm.*email/.test(lower)) {
    return "Please confirm your email address before signing in.";
  }
  if (/valid.*email|email.*invalid|invalid format/.test(lower)) {
    return "Please enter a valid email address.";
  }
  if (/network|fetch failed|failed to fetch|connection/.test(lower)) {
    return "Connection problem. Please check your internet and try again.";
  }
  if (/session.*expired|session.*missing|no session/.test(lower)) {
    return "Your session has expired. Please sign in again.";
  }

  console.error("[authError] Unmapped auth error:", error);
  return "Something went wrong. Please try again.";
}
