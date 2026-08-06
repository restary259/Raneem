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

