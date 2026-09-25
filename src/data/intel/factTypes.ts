/**
 * DARB Major Intelligence — fact & source schema.
 * ---------------------------------------------------------------------------
 * Hard rule: no source, no fact. Every factual claim rendered in the team tool
 * must be a `VerifiedFact` carrying its type, its source and the date it was
 * checked. A missing fact is represented explicitly (`unverified(...)`), never
 * by an empty string or an inferred value.
 */

export type FactType =
  | 'OFFICIAL_REQUIREMENT'
  | 'OFFICIAL_PROCEDURE'
  | 'OFFICIAL_DEADLINE'
  | 'OFFICIAL_ADMISSION_MODE'
  | 'OFFICIAL_LANGUAGE'
  | 'OFFICIAL_DOCUMENT_REQUIREMENT'
  | 'CALCULATED_VALUE'
  | 'DARB_OPERATIONAL_GUIDANCE';

/** Tier 1 = the university itself; tier 4 = DARB's own operational guidance. */
export type SourceAuthority =
  | 'university'
  | 'anabin'
  | 'kmk'
  | 'hochschulstart'
  | 'uni_assist'
  | 'daad'
  | 'government'
  | 'test_provider'
  | 'darb';

export const AUTHORITY_TIER: Record<SourceAuthority, 1 | 2 | 3 | 4> = {
  university: 1,
  anabin: 2,
  kmk: 2,
  hochschulstart: 2,
  uni_assist: 2,
  daad: 2,
  government: 2,
  test_provider: 3,
  darb: 4,
};

export interface IntelSource {
  id: string;
  /** Exact page or document — never a homepage. */
  url: string;
  title: string;
  titleAR?: string;
  authority: SourceAuthority;
  /** ISO date (YYYY-MM-DD) the URL was last checked. */
  checkedAt: string;
}

export type VerificationStatus = 'verified' | 'stale' | 'conflicting' | 'unverified';

export interface ConflictingValue<T> {
  value: T;
  sourceId: string;
}

export interface VerifiedFact<T> {
  /** `null` whenever the fact is unverified or conflicting. */
  value: T | null;
  factType: FactType;
  sourceId: string | null;
  checkedAt: string | null;
  status: VerificationStatus;
  /** Shown verbatim to the team (e.g. what to check, or why it is unknown). */
  note?: string;
  noteAR?: string;
  /** Optional precise evidence locator for internal/source-register-backed facts. */
  evidenceRef?: string;
  /** Populated only when `status === 'conflicting'`. */
  conflict?: ConflictingValue<T>[];
}

/** Facts that change often (deadlines, admission mode, NC) go stale faster. */
export const STALE_AFTER_DAYS: Record<'volatile' | 'standard', number> = {
  volatile: 120,
  standard: 365,
};

const VOLATILE_TYPES: FactType[] = [
  'OFFICIAL_DEADLINE',
  'OFFICIAL_ADMISSION_MODE',
];

/** Recomputes `stale` from `checkedAt` at render time. Never mutates input. */
export function withFreshness<T>(f: VerifiedFact<T>, now: Date = new Date()): VerifiedFact<T> {
  if (f.status !== 'verified' || !f.checkedAt) return f;
  const limit = VOLATILE_TYPES.includes(f.factType)
    ? STALE_AFTER_DAYS.volatile
    : STALE_AFTER_DAYS.standard;
  const ageDays = (now.getTime() - new Date(f.checkedAt).getTime()) / 86_400_000;
  return ageDays > limit ? { ...f, status: 'stale' } : f;
}

/** A verified fact backed by exactly one source. */
export function fact<T>(
  value: T,
  factType: FactType,
  sourceId: string,
  checkedAt: string,
  extra?: { note?: string; noteAR?: string; evidenceRef?: string },
): VerifiedFact<T> {
  return { value, factType, sourceId, checkedAt, status: 'verified', ...extra };
}

/** No official evidence found. The UI must tell the team not to assume one. */
export function unverified<T>(
  factType: FactType,
  note: string,
  noteAR?: string,
): VerifiedFact<T> {
  return { value: null, factType, sourceId: null, checkedAt: null, status: 'unverified', note, noteAR };
}

/** Two official sources disagree — never resolved automatically. */
export function conflicting<T>(
  factType: FactType,
  values: ConflictingValue<T>[],
  note?: string,
  noteAR?: string,
): VerifiedFact<T> {
  return {
    value: null,
    factType,
    sourceId: null,
    checkedAt: null,
    status: 'conflicting',
    conflict: values,
    note,
    noteAR,
  };
}

/** DARB's own operational guidance — never presented as an official rule. */
export function guidance(text: string, textAR: string): VerifiedFact<string> {
  return {
    value: text,
    factType: 'DARB_OPERATIONAL_GUIDANCE',
    sourceId: null,
    checkedAt: null,
    status: 'verified',
    noteAR: textAR,
  };
}
