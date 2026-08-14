/**
 * Referral attribution.
 *
 * A referral code arrives as `?ref=<code>` on any public page. We store it the
 * moment it is seen (most visitors do not convert on the first visit) and read
 * it back on submit. The code itself is always resolved server-side, so a
 * spoofed value can never credit an arbitrary user id.
 */

const STORAGE_KEY = 'darb_ref';
const TTL_DAYS = 90;

interface StoredRef {
  code: string;
  savedAt: number;
}

const SESSION_KEY = 'darb_ref_session';

/** Stable per-browser id used to de-duplicate link clicks. Never sent anywhere else. */
function getSessionId(): string {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

/** Fire-and-forget click record for a partner link. Unknown codes are ignored server-side. */
async function recordClick(code: string): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    await (supabase as any).rpc('record_partner_click', {
      p_code: code,
      p_session_id: getSessionId(),
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    /* tracking must never block the visitor */
  }
}

/** Reads `?ref=` from the current URL and persists it. Safe to call on every page. */
export function captureReferralCode(search?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    const raw = params.get('ref');
    if (!raw) return getReferralCode();

    const code = raw.trim().slice(0, 40);
    if (!/^[a-zA-Z0-9-]{3,40}$/.test(code)) return getReferralCode();

    const payload: StoredRef = { code, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    void recordClick(code);
    return code;
  } catch {
    return null;
  }
}


/** Returns the stored referral code, or null when absent or expired. */
export function getReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code) return null;
    const ageDays = (Date.now() - parsed.savedAt) / 86_400_000;
    if (ageDays > TTL_DAYS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface ReferralHealth {
  /** The code is known, enabled and owned by an active referring account. */
  valid: boolean;
  /** First name of the owner — the only thing the lookup ever returns. */
  ownerName: string | null;
  /**
   * True when the health check could NOT complete (network/RPC error). This is
   * NOT the same as `valid: false` (a genuinely invalid/disabled code): the
   * code may still be perfectly good, we just couldn't verify it this time.
   * Callers should KEEP (not drop) the stored code when `unverified` is true —
   * the server resolves it again at submission, so a transient client-side
   * lookup failure must never strip a partner's attribution from the case.
   */
  unverified?: boolean;
}

/**
 * Health check for a referral token.
 *
 * Legacy links, disabled codes and codes belonging to removed accounts all
 * come back invalid. A failed check also *deletes* the stored token, so a
 * broken link can never silently attribute a student to the wrong partner on
 * a later visit.
 *
 * A network/RPC failure is reported as `{ valid: false, unverified: true }`
 * and does NOT delete the stored token — the code might be fine, we simply
 * could not reach the server to confirm it. The apply form keeps the code and
 * still submits it, because `create-case-from-apply` resolves the code
 * server-side anyway (and ignores it if it turns out to be invalid).
 */
export async function verifyReferralCode(code: string | null): Promise<ReferralHealth> {
  if (!code) return { valid: false, ownerName: null };

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await (supabase as any).rpc('check_referral_code', { p_code: code });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.valid) return { valid: true, ownerName: row.owner_name ?? null };

    clearReferralCode();
    return { valid: false, ownerName: null };
  } catch {
    // Network/RPC failure is not proof the code is bad — keep it stored. Mark
    // `unverified` so the caller can distinguish "could not check" from "checked
    // and rejected" and avoid dropping a valid attribution.
    return { valid: false, ownerName: null, unverified: true };
  }
}


/**
 * Decision helper for the apply form: given a `verifyReferralCode` result,
 * returns whether the stored referral code should be KEPT and submitted.
 *
 * - A valid code is kept.
 * - An unverified code (transient network/RPC error) is KEPT — the server
 *   resolves it again at submission, so a momentary lookup failure must never
 *   strip a partner's attribution from the case (which would leave the case
 *   unattributed: visible to Admin, invisible to the partner dashboard / KPI).
 * - A server-confirmed rejection (valid:false, not unverified) drops the code.
 *
 * Extracted as a pure function so the apply form's attribution-preservation
 * guarantee is unit-testable without rendering React.
 */
export function shouldKeepReferralCode(health: ReferralHealth): boolean {
  return health.valid || !!health.unverified;
}


/**
 * Canonical public site address. Referral links are always built from this and
 * never from `window.location.origin`, so preview/sandbox hosts are never
 * exposed to partners, ambassadors or students.
 */
export const SITE_URL = 'https://darb.agency';

/** Full shareable application link for a code. */
export function buildReferralUrl(code: string): string {
  return `${SITE_URL}/apply?ref=${encodeURIComponent(code)}`;
}

