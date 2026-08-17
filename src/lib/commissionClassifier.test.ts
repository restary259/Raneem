import { describe, expect, it } from "vitest";
import {
  classifyReward,
  isPartnerPool,
  isStudentReferral,
  isTeam,
  type ClassifiableReward,
} from "./commissionClassifier";

const r = (reward_type?: string | null, admin_notes?: string | null): ClassifiableReward => ({
  reward_type: reward_type ?? null,
  admin_notes: admin_notes ?? null,
});

describe("commissionClassifier — isTeam", () => {
  it("matches the team reward_type", () => {
    expect(isTeam(r("team"))).toBe(true);
  });
  it("matches the legacy 'Team commission' note prefix", () => {
    expect(isTeam(r(null, "Team commission from case REF-1"))).toBe(true);
  });
  it("rejects non-team reward_types", () => {
    expect(isTeam(r("referral"))).toBe(false);
    expect(isTeam(r("student_referral"))).toBe(false);
    expect(isTeam(r("agent_override"))).toBe(false);
  });
  it("rejects unrelated notes", () => {
    expect(isTeam(r(null, "Partner commission from case REF-1"))).toBe(false);
  });
});

describe("commissionClassifier — isStudentReferral", () => {
  it("matches the student_referral reward_type", () => {
    expect(isStudentReferral(r("student_referral"))).toBe(true);
  });
  it("matches legacy 'Student friend/family/referral' note prefixes", () => {
    expect(isStudentReferral(r(null, "Student friend referral reward from case X"))).toBe(true);
    expect(isStudentReferral(r(null, "Student family referral reward from case X"))).toBe(true);
    expect(isStudentReferral(r(null, "Student referral reward from case X"))).toBe(true);
  });
  it("rejects partner/team reward_types", () => {
    expect(isStudentReferral(r("referral"))).toBe(false);
    expect(isStudentReferral(r("team"))).toBe(false);
  });
});

describe("commissionClassifier — isPartnerPool", () => {
  it("includes the referral reward_type (partner/ambassador)", () => {
    expect(isPartnerPool(r("referral"))).toBe(true);
  });
  it("includes master_partner, master_override, agent_override (historical)", () => {
    expect(isPartnerPool(r("master_partner"))).toBe(true);
    expect(isPartnerPool(r("master_override"))).toBe(true);
    expect(isPartnerPool(r("agent_override"))).toBe(true);
  });
  it("includes ambassador and agent_recruitment", () => {
    expect(isPartnerPool(r("ambassador"))).toBe(true);
    expect(isPartnerPool(r("agent_recruitment"))).toBe(true);
  });
  it("excludes team and student_referral (margin-funded, separate)", () => {
    expect(isPartnerPool(r("team"))).toBe(false);
    expect(isPartnerPool(r("student_referral"))).toBe(false);
  });
  it("matches legacy note prefixes the canonical engine writes", () => {
    expect(isPartnerPool(r(null, "Partner commission from case REF-1"))).toBe(true);
    expect(isPartnerPool(r(null, "Recruitment share from case REF-1"))).toBe(true);
    expect(isPartnerPool(r(null, "Agent recruitment share from case REF-1"))).toBe(true);
  });
  it("does NOT match a loose 'Agent ' prefix (regression guard)", () => {
    expect(isPartnerPool(r(null, "Agent outreach bonus (not commission)"))).toBe(false);
  });
  it("does NOT match 'Network override' (dropped legacy, not written by engine)", () => {
    expect(isPartnerPool(r(null, "Network override something"))).toBe(false);
  });
  it("includes legacy network_split in the partner pool", () => {
    expect(isPartnerPool(r("network_split"))).toBe(true);
  });
  it("excludes unknown reward_types (whitelist, not blacklist)", () => {
    expect(isPartnerPool(r("platform_refund"))).toBe(false);
    expect(isPartnerPool(r("penalty"))).toBe(false);
    expect(isPartnerPool(r("translation_bonus"))).toBe(false);
  });
});

describe("commissionClassifier — classifyReward", () => {
  it("classifies referral as partner (or agent_self_referral by note)", () => {
    expect(classifyReward(r("referral", "Partner commission from case X"))).toBe("partner");
    expect(classifyReward(r("referral", "Agent self-referral from case X"))).toBe("agent_self_referral");
  });
  it("classifies historical master_partner/master_override/network_split as 'other' (legacy display)", () => {
    expect(classifyReward(r("master_partner"))).toBe("other");
    expect(classifyReward(r("master_override"))).toBe("other");
    expect(classifyReward(r("network_split"))).toBe("other");
  });
  it("classifies agent_override as agent_recruitment", () => {
    expect(classifyReward(r("agent_override"))).toBe("agent_recruitment");
  });
  it("classifies ambassador and agent_recruitment", () => {
    expect(classifyReward(r("ambassador", "Ambassador commission from case X"))).toBe("ambassador");
    expect(classifyReward(r("agent_recruitment"))).toBe("agent_recruitment");
  });
  it("classifies student_referral", () => {
    expect(classifyReward(r("student_referral"))).toBe("student_referral");
  });
  it("classifies team", () => {
    expect(classifyReward(r("team"))).toBe("team");
  });
  it("falls back to 'other' for unknown reward_types and notes", () => {
    expect(classifyReward(r("unknown_type", "Some random note"))).toBe("other");
    expect(classifyReward(r(null, "Some random note"))).toBe("other");
    expect(classifyReward(r(null, null))).toBe("other");
  });
  it("falls back to legacy note mapping when reward_type is absent", () => {
    expect(classifyReward(r(null, "Partner commission from case X"))).toBe("partner");
    expect(classifyReward(r(null, "Team commission from case X"))).toBe("team");
  });
});
