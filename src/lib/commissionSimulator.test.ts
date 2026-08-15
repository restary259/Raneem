import { describe, expect, it } from "vitest";
import { simulateCommission } from "./commissionSimulator";

const base = {
  grossTotal: 5000,
  referralDiscount: 0,
  partnerPool: 1000,
  masterShare: 0,
  agentShare: 500,
  teamRate: 100,
  studentReward: 200,
};

describe("simulateCommission — partner (additive)", () => {
  it("matches the canonical engine trace: 5000 case, 1000 pool, 500 agent", () => {
    const r = simulateCommission({ ...base, acquisitionType: "partner" });
    expect(r.net).toBe(5000);
    expect(r.partnerShare).toBe(1000);
    expect(r.agentShare).toBe(500);
    expect(r.teamCommission).toBe(100);
    expect(r.totalPayouts).toBe(1600);
    expect(r.darbMargin).toBe(3400);
    expect(r.negativeMargin).toBe(false);
  });

  it("subtracts the referral discount from NET before margin", () => {
    const r = simulateCommission({ ...base, acquisitionType: "partner", referralDiscount: 500 });
    expect(r.net).toBe(4500);
    expect(r.darbMargin).toBe(2900); // 4500 - 100 - 1000 - 500
    expect(r.totalPayouts).toBe(1600); // payouts unchanged by discount
  });

  it("deducts the master carve from the partner share, not the margin", () => {
    const r = simulateCommission({ ...base, acquisitionType: "partner", masterShare: 300 });
    expect(r.masterShare).toBe(300);
    expect(r.partnerShare).toBe(700); // 1000 pool - 300 master
    expect(r.darbMargin).toBe(3400); // margin unaffected: master comes from pool
    expect(r.totalPayouts).toBe(1600);
  });

  it("clamps the master carve to the pool", () => {
    const r = simulateCommission({ ...base, acquisitionType: "partner", masterShare: 9999 });
    expect(r.masterShare).toBe(1000);
    expect(r.partnerShare).toBe(0);
  });
});

describe("simulateCommission — agent self-referral (isolated)", () => {
  it("pays only team + agent self amount, no pool", () => {
    const r = simulateCommission({ ...base, acquisitionType: "agent_self" });
    expect(r.partnerPool).toBe(0);
    expect(r.partnerShare).toBe(0);
    expect(r.agentShare).toBe(500);
    expect(r.teamCommission).toBe(100);
    expect(r.totalPayouts).toBe(600);
    expect(r.darbMargin).toBe(4400); // 5000 - 100 - 500
  });
});

describe("simulateCommission — student referral (isolated)", () => {
  it("pays only team + student reward, no upstream propagation", () => {
    const r = simulateCommission({ ...base, acquisitionType: "student" });
    expect(r.partnerPool).toBe(0);
    expect(r.agentShare).toBe(0);
    expect(r.studentReward).toBe(200);
    expect(r.teamCommission).toBe(100);
    expect(r.totalPayouts).toBe(300);
    expect(r.darbMargin).toBe(4700); // 5000 - 100 - 200
  });
});

describe("simulateCommission — direct (no referrer)", () => {
  it("pays only team commission", () => {
    const r = simulateCommission({ ...base, acquisitionType: "direct" });
    expect(r.teamCommission).toBe(100);
    expect(r.totalPayouts).toBe(100);
    expect(r.darbMargin).toBe(4900);
  });
});

describe("simulateCommission — negative margin", () => {
  it("flags negative margin when payouts exceed NET", () => {
    const r = simulateCommission({
      ...base,
      acquisitionType: "partner",
      partnerPool: 6000, // exceeds the 5000 net
    });
    expect(r.totalPayouts).toBe(6600); // 100 + 6000 + 500
    expect(r.net).toBe(5000);
    expect(r.negativeMargin).toBe(true);
    expect(r.darbMargin).toBe(0); // clamped, not negative
  });

  it("clamps NET at 0 when discount exceeds gross", () => {
    const r = simulateCommission({
      ...base,
      acquisitionType: "direct",
      grossTotal: 1000,
      referralDiscount: 5000,
    });
    expect(r.net).toBe(0);
    expect(r.darbMargin).toBe(0);
    expect(r.negativeMargin).toBe(true); // team (100) > net (0)
  });
});
