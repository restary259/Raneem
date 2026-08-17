/**
 * Pure reward-classification logic shared by the dashboard financials and the
 * commissions spreadsheet. Extracted so the classification rules have a single
 * source of truth and can be unit-tested without a database or mocks.
 *
 * reward_type is authoritative; admin_notes prefix matching is a fallback for
 * legacy rows that predate the reward_type column.
 */

export type RewardKind =
  | "team"
  | "student_referral"
  | "partner"
  | "ambassador"
  | "agent_self_referral"
  | "agent_recruitment"
  | "other";

export interface ClassifiableReward {
  reward_type?: string | null;
  admin_notes?: string | null;
}

export const isTeam = (r: ClassifiableReward): boolean =>
  r.reward_type ? r.reward_type === "team" : (r.admin_notes ?? "").startsWith("Team commission");

export const isStudentReferral = (r: ClassifiableReward): boolean => {
  if (r.reward_type) return r.reward_type === "student_referral";
  const n = r.admin_notes ?? "";
  return n.startsWith("Student friend") || n.startsWith("Student family") || n.startsWith("Student referral");
};

const PARTNER_POOL_REWARD_TYPES = new Set([
  "referral",
  "partner",
  "ambassador",
  "agent_recruitment",
  // Historical types kept so already-paid rewards still bucket into the
  // partner pool for dashboard financials. No new rewards of these types are
  // created by the simplified engine (master partners were removed).
  "master_partner",
  "master_override",
  "agent_override",
  "network_split",
]);

// ── Single source for the legacy note-prefix fallback ──────────────────────
// These prefixes are what the canonical engine writes into admin_notes. The
// list is shared by isPartnerPool (financial totals) and classifyReward
// (display kind) so the two cannot drift. A prefix maps to a display kind;
// "Recruitment share" is a legacy master-era note that is intentionally
// partner-pool for financials (it reduced platform margin) but displays as
// "other" (no active master tier is implied) — so it appears in the
// pool-prefix set but not in the kind table.
const NOTE_PREFIX_TO_KIND: ReadonlyArray<[string, RewardKind]> = [
  ["Agent self-referral", "agent_self_referral"],
  ["Agent recruitment share", "agent_recruitment"],
  ["Ambassador commission", "ambassador"],
  ["Partner commission", "partner"],
  ["Team commission", "team"],
];

const PARTNER_POOL_NOTE_PREFIXES: ReadonlyArray<string> = [
  "Partner commission",
  "Ambassador commission",
  "Recruitment share",
  "Agent recruitment share",
];

const KIND_BY_REWARD_TYPE = (notes: string): Record<string, RewardKind> => ({
  team: "team",
  referral: notes.startsWith("Agent self-referral") ? "agent_self_referral" : "partner",
  ambassador: "ambassador",
  agent_recruitment: "agent_recruitment",
  agent_override: "agent_recruitment",
  // Historical master types — the engine no longer creates these. Map legacy
  // rows to "other" so they are displayed without implying an active master tier.
  master_partner: "other",
  master_override: "other",
  network_split: "other",
  student_referral: "student_referral",
  partner: "partner",
});

export const isPartnerPool = (r: ClassifiableReward): boolean => {
  if (r.reward_type) return PARTNER_POOL_REWARD_TYPES.has(r.reward_type);
  // Legacy fallback (rows without reward_type): match the engine's note prefixes.
  const notes = r.admin_notes ?? "";
  return PARTNER_POOL_NOTE_PREFIXES.some((p) => notes.startsWith(p));
};

export const classifyReward = (r: ClassifiableReward): RewardKind => {
  const notes = r.admin_notes ?? "";
  const byType = KIND_BY_REWARD_TYPE(notes);
  const mapped = r.reward_type ? byType[r.reward_type] : undefined;
  if (mapped) return mapped;
  for (const [prefix, kind] of NOTE_PREFIX_TO_KIND) {
    if (notes.startsWith(prefix)) return kind;
  }
  return "other";
};
