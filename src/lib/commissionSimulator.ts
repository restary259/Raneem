/**
 * Pure commission-split calculator — mirrors the ADDITIVE model in the
 * `record_case_commission` SQL engine (migration 20260817040000).
 *
 * net          = max(0, gross − referralDiscount)
 * partnerShare = max(0, partnerPool − masterShare)   (master carve is from the pool)
 * darbMargin   = max(0, net − team − partnerPool − agentShare − studentReward)
 *
 * The agent share and the student-referral reward are ADDITIVE (funded from
 * Darb's margin, on top of the partner's full pool). The master carve comes
 * OUT of the partner pool, so the partner keeps `partnerPool − masterShare`.
 *
 * This is a pure function with no side effects — used by the Admin Commission
 * Hub simulator (Phase 4) for "what-if" previews. It does NOT write anything.
 */
export type AcquisitionType =
  | "partner" // partner/ambassador referral (professional pool)
  | "agent_self" // agent self-referral (no partner pool)
  | "student" // student→student referral (isolated)
  | "direct"; // no referrer (team commission only)

export interface CommissionSimInput {
  acquisitionType: AcquisitionType;
  grossTotal: number;
  referralDiscount: number;
  /** Partner pool amount (₪). Used for partner type only. */
  partnerPool: number;
  /** Master recruitment carve (₪), taken from the pool. Partner type only. */
  masterShare: number;
  /** Additive agent override (₪), from Darb's margin. Partner type only. */
  agentShare: number;
  /** Flat team commission (₪), from margin. All types (when assigned). */
  teamRate: number;
  /** Student-referral reward (₪), from margin. Student type only. */
  studentReward: number;
}

export interface CommissionSimResult {
  net: number;
  teamCommission: number;
  partnerPool: number;
  partnerShare: number;
  masterShare: number;
  agentShare: number;
  studentReward: number;
  totalPayouts: number;
  darbMargin: number;
  /** true when total payouts exceed NET (would trigger a margin warning). */
  negativeMargin: boolean;
}

export const simulateCommission = (input: CommissionSimInput): CommissionSimResult => {
  const gross = Math.max(0, Number(input.grossTotal) || 0);
  const discount = Math.max(0, Number(input.referralDiscount) || 0);
  const net = Math.max(0, gross - discount);

  const team = Math.max(0, Number(input.teamRate) || 0);
  const pool = Math.max(0, Number(input.partnerPool) || 0);
  const masterRaw = Math.max(0, Number(input.masterShare) || 0);
  const agent = Math.max(0, Number(input.agentShare) || 0);
  const student = Math.max(0, Number(input.studentReward) || 0);

  // Master carve is clamped to the pool and taken from it.
  const master = Math.min(masterRaw, pool);
  const partnerShare = Math.max(0, pool - master);

  let totalPayouts: number;
  let darbMargin: number;

  switch (input.acquisitionType) {
    case "agent_self":
      // Agent self-referral: pays only the agent self-referral amount + team.
      // No partner pool, no agent_override (isolation).
      totalPayouts = team + agent;
      darbMargin = Math.max(0, net - team - agent);
      return {
        net,
        teamCommission: team,
        partnerPool: 0,
        partnerShare: 0,
        masterShare: 0,
        agentShare: agent,
        studentReward: 0,
        totalPayouts,
        darbMargin,
        negativeMargin: totalPayouts > net,
      };

    case "student":
      // Student→student referral (Rule 6, ISOLATED): pays only the student
      // reward + team. No upstream propagation.
      totalPayouts = team + student;
      darbMargin = Math.max(0, net - team - student);
      return {
        net,
        teamCommission: team,
        partnerPool: 0,
        partnerShare: 0,
        masterShare: 0,
        agentShare: 0,
        studentReward: student,
        totalPayouts,
        darbMargin,
        negativeMargin: totalPayouts > net,
      };

    case "direct":
      // No referrer: team commission only.
      totalPayouts = team;
      darbMargin = Math.max(0, net - team);
      return {
        net,
        teamCommission: team,
        partnerPool: 0,
        partnerShare: 0,
        masterShare: 0,
        agentShare: 0,
        studentReward: 0,
        totalPayouts,
        darbMargin,
        negativeMargin: totalPayouts > net,
      };

    case "partner":
    default:
      // Partner/ambassador referral (additive): team + pool + agent from margin.
      totalPayouts = team + pool + agent;
      darbMargin = Math.max(0, net - team - pool - agent);
      return {
        net,
        teamCommission: team,
        partnerPool: pool,
        partnerShare,
        masterShare: master,
        agentShare: agent,
        studentReward: 0,
        totalPayouts,
        darbMargin,
        negativeMargin: totalPayouts > net,
      };
  }
};
