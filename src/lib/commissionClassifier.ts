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
  | "agent_self_referral"
  | "master_override"
  | "agent_override"
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
  "master_partner",
  "master_override",
  "agent_override",
  // Legacy reward_type written by pre-canonical engine versions for the
  // master's recruitment share. Kept so historical paid rewards still bucket
  // into the partner pool for the dashboard financials.
  "network_split",
]);

export const isPartnerPool = (r: ClassifiableReward): boolean => {
  if (r.reward_type) return PARTNER_POOL_REWARD_TYPES.has(r.reward_type);
  // Legacy fallback: match the exact note prefixes the canonical engine writes.
  const notes = r.admin_notes ?? "";
  return (
    notes.startsWith("Partner commission") ||
    notes.startsWith("Recruitment share") ||
    notes.startsWith("Agent recruitment share")
  );
};

const KIND_BY_REWARD_TYPE = (notes: string): Record<string, RewardKind> => ({
  team: "team",
  referral: notes.startsWith("Agent self-referral") ? "agent_self_referral" : "partner",
  master_partner: "master_override",
  master_override: "master_override",
  network_split: "master_override",
  agent_override: "agent_override",
  student_referral: "student_referral",
  partner: "partner",
});

export const classifyReward = (r: ClassifiableReward): RewardKind => {
  const notes = r.admin_notes ?? "";
  const byType = KIND_BY_REWARD_TYPE(notes);
  const mapped = r.reward_type ? byType[r.reward_type] : undefined;
  if (mapped) return mapped;
  if (notes.startsWith("Partner commission")) return "partner";
  if (notes.startsWith("Team commission")) return "team";
  return "other";
};
