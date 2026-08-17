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

export const isPartnerPool = (r: ClassifiableReward): boolean => {
  if (r.reward_type) return PARTNER_POOL_REWARD_TYPES.has(r.reward_type);
  // Legacy fallback: match the exact note prefixes the canonical engine writes.
  const notes = r.admin_notes ?? "";
  return (
    notes.startsWith("Partner commission") ||
    notes.startsWith("Ambassador commission") ||
    notes.startsWith("Recruitment share") ||
    notes.startsWith("Agent recruitment share")
  );
};

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

export const classifyReward = (r: ClassifiableReward): RewardKind => {
  const notes = r.admin_notes ?? "";
  const byType = KIND_BY_REWARD_TYPE(notes);
  const mapped = r.reward_type ? byType[r.reward_type] : undefined;
  if (mapped) return mapped;
  if (notes.startsWith("Partner commission")) return "partner";
  if (notes.startsWith("Ambassador commission")) return "ambassador";
  if (notes.startsWith("Team commission")) return "team";
  if (notes.startsWith("Agent self-referral")) return "agent_self_referral";
  if (notes.startsWith("Agent recruitment share")) return "agent_recruitment";
  return "other";
};
