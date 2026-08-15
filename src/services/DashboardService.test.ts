import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Minimal chainable mock for the supabase query builder used by
 * DashboardService.financialOverview. Each `.from(table)` call returns a
 * builder whose terminal await resolves to `{ data, error }`.
 *
 * The mock inspects the table name to decide which dataset to return, so the
 * four parallel queries (case_submissions, rewards, cases, platform_settings)
 * each get their own controlled data.
 */
type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | Row | null; error: null };

const tableData: Record<string, Row[] | Row> = {
  case_payments: [],
  rewards: [],
  cases: [],
  platform_settings: {},
};

function builder(table: string): QueryResult & PromiseLike<QueryResult> {
  const result: QueryResult = {
    get data() {
      return tableData[table] ?? null;
    },
    error: null,
  };
  const chain = {
    data: result.data,
    error: null as null,
    select: () => chain,
    not: () => chain,
    eq: () => chain,
    order: () => chain,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: QueryResult) => void) => Promise.resolve(result).then(resolve),
  };
  return chain as QueryResult & PromiseLike<QueryResult>;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
  },
}));

import { DashboardService } from "./DashboardService";

function setTable(table: string, rows: Row[] | Row): void {
  tableData[table] = rows;
}

beforeEach(() => {
  tableData.case_payments = [];
  tableData.rewards = [];
  tableData.cases = [];
  tableData.platform_settings = { partner_commission_rate: 0 };
});

const reward = (overrides: Partial<Row>): Row => ({
  amount: 100,
  status: "paid",
  case_id: "case-1",
  ...overrides,
});

describe("DashboardService.financialOverview — reward classification", () => {
  it("counts referral rewards (recipient_role=partner) in the partner pool", async () => {
    setTable("rewards", [
      reward({ reward_type: "referral", recipient_role: "partner", amount: 500, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(500);
  });

  it("counts agent self-referral rewards in the partner pool (the original bug)", async () => {
    setTable("rewards", [
      reward({ reward_type: "referral", recipient_role: "agent", amount: 300, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    // Before the fix, agent self-referral rewards fell into NEITHER bucket.
    expect(r.partnerCommissionPaid).toBe(300);
  });

  it("counts agent_override rewards in the partner pool", async () => {
    setTable("rewards", [
      reward({ reward_type: "agent_override", amount: 200, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(200);
  });

  it("counts master_partner and network_split rewards in the partner pool", async () => {
    setTable("rewards", [
      reward({ reward_type: "master_partner", amount: 150, status: "paid" }),
      reward({ reward_type: "network_split", amount: 75, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(225);
  });

  it("counts master_override rewards in the partner pool", async () => {
    setTable("rewards", [
      reward({ reward_type: "master_override", amount: 100, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(100);
  });

  it("excludes team rewards from the partner pool", async () => {
    setTable("rewards", [
      reward({ reward_type: "team", amount: 400, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(0);
  });

  it("separates pending/approved from paid partner commissions", async () => {
    setTable("rewards", [
      reward({ reward_type: "referral", amount: 100, status: "pending" }),
      reward({ reward_type: "referral", amount: 200, status: "approved" }),
      reward({ reward_type: "referral", amount: 300, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPending).toBe(300);
    expect(r.partnerCommissionPaid).toBe(300);
  });

  it("falls back to admin_notes prefix for legacy rows without reward_type", async () => {
    setTable("rewards", [
      reward({ reward_type: null, admin_notes: "Partner commission from case X", amount: 250, status: "paid" }),
      reward({ reward_type: null, admin_notes: "Team commission from case X", amount: 100, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.partnerCommissionPaid).toBe(250);
  });

  it("does not double-count: every reward lands in exactly one bucket", async () => {
    setTable("rewards", [
      reward({ reward_type: "team", amount: 100, status: "paid" }),
      reward({ reward_type: "referral", amount: 200, status: "paid" }),
      reward({ reward_type: "agent_override", amount: 50, status: "paid" }),
      reward({ reward_type: "master_partner", amount: 75, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    // partner pool = 200 + 50 + 75 = 325; team is separate (not in partner pool)
    expect(r.partnerCommissionPaid).toBe(325);
  });

  it("subtracts partner commissions from platform net revenue", async () => {
    setTable("case_payments", [{ amount: 1000, confirmed_at: "2026-01-01", case_id: "case-1" }]);
    setTable("rewards", [
      reward({ reward_type: "referral", amount: 300, status: "paid" }),
      reward({ reward_type: "team", amount: 100, status: "paid" }),
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.serviceFees).toBe(1000);
    expect(r.platformNetRevenue).toBe(1000 - 300 - 100);
  });

  it("reads service fees from confirmed case_payments (agency_service)", async () => {
    setTable("case_payments", [
      { amount: 5000, confirmed_at: "2026-01-15", case_id: "case-1" },
      { amount: 3000, confirmed_at: "2026-01-20", case_id: "case-2" },
    ]);
    const r = await DashboardService.financialOverview();
    expect(r.serviceFees).toBe(8000);
    expect(r.submissions).toHaveLength(2);
    expect(r.submissions[0].effective_service_fee).toBe(5000);
  });

  it("falls back to platform_revenue_ils reconstruction when no case_payments exist", async () => {
    setTable("case_payments", []);
    setTable("cases", [
      { id: "case-1", referral_discount: 0, platform_revenue_ils: 3400, status: "enrollment_paid" },
    ]);
    setTable("rewards", [
      reward({ reward_type: "referral", amount: 1000, status: "paid", case_id: "case-1" }),
      reward({ reward_type: "team", amount: 100, status: "paid", case_id: "case-1" }),
      reward({ reward_type: "agent_override", amount: 500, status: "paid", case_id: "case-1" }),
    ]);
    const r = await DashboardService.financialOverview();
    // 3400 (platform revenue) + 100 (team) + 1000 (partner) + 500 (agent) = 5000
    expect(r.serviceFees).toBe(5000);
    expect(r.platformNetRevenue).toBe(3400);
  });
});
