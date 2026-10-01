/**
 * DARB-side "suggested match" heuristic for the Phase 3 location selector.
 *
 * This SUGGESTS, it never decides — the admin always confirms, and the server
 * re-validates. It is deliberately never presented as Google-verified: the
 * label is "Suggested match", not "Verified".
 *
 * Pure and dependency-free so it can be unit tested without a browser.
 */

export type OfficeMatchInput = {
  name?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type LocationMatchInput = {
  title?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type MatchSignalKey =
  "city" | "postalCode" | "phone" | "website" | "name" | "address";

export type MatchSignal = { key: MatchSignalKey; matched: boolean };

export type LocationMatch = {
  /** 0..100. A heuristic confidence, never a verification. */
  score: number;
  signals: MatchSignal[];
  /** True when the score clears the "worth suggesting" bar. */
  suggested: boolean;
};

/** Lowercase, drop punctuation/space so "+49 30 1" == "+49301". */
function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Lowercase, collapse whitespace (for name/address text). */
function words(value: string | null | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff\u0590-\u05ff\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Jaccard-ish overlap of significant tokens (0..1). */
function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared++;
  return shared / Math.max(setA.size, setB.size);
}

/** Host of a URL, ignoring scheme/www/path ("https://www.darb.agency/x" -> darb.agency). */
function host(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalize(raw);
  }
}

const WEIGHTS: Record<MatchSignalKey, number> = {
  city: 30,
  postalCode: 25,
  phone: 20,
  website: 15,
  name: 5,
  address: 5,
};

const SUGGEST_THRESHOLD = 55;

/**
 * Compares an office with a discovered Google location and returns a heuristic
 * score plus which signals agreed. Name alone is never decisive: it carries the
 * smallest weight, and a name-only match cannot reach the threshold.
 */
export function suggestLocationMatch(
  office: OfficeMatchInput,
  location: LocationMatchInput,
): LocationMatch {
  const signals: MatchSignal[] = [];

  const cityOk =
    normalize(office.city).length > 0 &&
    normalize(office.city) === normalize(location.city);
  signals.push({ key: "city", matched: cityOk });

  const postalOk =
    normalize(office.postalCode).length > 0 &&
    normalize(office.postalCode) === normalize(location.postalCode);
  signals.push({ key: "postalCode", matched: postalOk });

  const phoneOk =
    normalize(office.phone).length >= 6 &&
    normalize(office.phone) === normalize(location.phone);
  signals.push({ key: "phone", matched: phoneOk });

  const officeHost = host(office.website);
  const locationHost = host(location.website);
  const websiteOk = officeHost.length > 0 && officeHost === locationHost;
  signals.push({ key: "website", matched: websiteOk });

  const nameOk = tokenOverlap(words(office.name), words(location.title)) >= 0.5;
  signals.push({ key: "name", matched: nameOk });

  const addressOk =
    tokenOverlap(words(office.addressLine1), words(location.addressLine1)) >=
    0.5;
  signals.push({ key: "address", matched: addressOk });

  const score = signals.reduce(
    (total, signal) => total + (signal.matched ? WEIGHTS[signal.key] : 0),
    0,
  );

  return {
    score: Math.min(100, score),
    signals,
    suggested: score >= SUGGEST_THRESHOLD,
  };
}

/** True when the office and the location look like the same physical place. */
export function addressesAgree(
  office: OfficeMatchInput,
  location: LocationMatchInput,
): boolean {
  const match = suggestLocationMatch(office, location);
  const byKey = new Map(match.signals.map((s) => [s.key, s.matched]));
  // Address agreement needs a locality anchor, not just a similar street name.
  return Boolean(
    (byKey.get("city") || byKey.get("postalCode")) &&
    (byKey.get("address") || byKey.get("postalCode")),
  );
}
