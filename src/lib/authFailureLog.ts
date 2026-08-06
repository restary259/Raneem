/**
 * Authorization-failure reporting.
 *
 * Records RLS denials and 401/403 responses from backend functions into
 * `auth_failure_log` so admins can spot regressions. Never throws and never
 * blocks the calling flow.
 */
import { supabase } from '@/integrations/supabase/client';

export type AuthFailureSource = 'rls' | 'edge_function';

const PERMISSION_CODES = new Set(['42501', 'PGRST301', 'PGRST302', '401', '403']);

/** True when a Supabase/PostgREST error represents an authorization denial. */
export function isAuthorizationError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? error.status ?? '');
  if (PERMISSION_CODES.has(code)) return true;
  const msg = String(error.message ?? '').toLowerCase();
  return (
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security policy') ||
    msg.includes('jwt expired') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden')
  );
}

interface LogArgs {
  source: AuthFailureSource;
  target: string;
  operation?: string;
  statusCode?: string | number | null;
  errorMessage?: string | null;
}

/** Fire-and-forget insert of one failure receipt. */
export async function logAuthFailure({
  source,
  target,
  operation,
  statusCode,
  errorMessage,
}: LogArgs): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id ?? null;
    await supabase.from('auth_failure_log').insert({
      user_id: userId,
      is_anonymous: !userId,
      source,
      target,
      operation: operation ?? null,
      status_code: statusCode != null ? String(statusCode) : null,
      error_message: errorMessage ? String(errorMessage).slice(0, 300) : null,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
    });
  } catch {
    // Monitoring must never break the app.
  }
}

/** Logs the error when it is an authorization denial. Returns true if logged. */
export function reportIfAuthFailure(
  error: any,
  target: string,
  source: AuthFailureSource = 'rls',
  operation?: string,
): boolean {
  if (!isAuthorizationError(error)) return false;
  void logAuthFailure({
    source,
    target,
    operation,
    statusCode: error?.code ?? error?.status ?? null,
    errorMessage: error?.message ?? null,
  });
  return true;
}
