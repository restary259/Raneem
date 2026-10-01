import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for the direct-registration workflow (PR #148). These are source-level
 * assertions because the defects they cover are only observable in the database
 * or against the live catalog, and every one of them failed silently rather
 * than throwing where a test could see it.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const MIGRATION = "supabase/migrations/20261001090000_student_referral_registration.sql";
const COMPLETE_MIGRATION = "supabase/migrations/20261001150000_complete_student_referral_registration_workflow.sql";
const FLOW = "src/components/student/ReferralRegistrationFlow.tsx";
const COMMAND_CENTER = "src/pages/admin/AdminCommandCenter.tsx";

describe("student referral registration migration", () => {
  const sql = read(MIGRATION);

  it("uses valid dollar-quote delimiters for every function body", () => {
    // `AS $` / `$;` is not a dollar quote at all — Postgres rejects the file and
    // no registration table or function is ever created.
    expect(sql).not.toMatch(/^AS \$$/m);
    expect(sql).not.toMatch(/^\$;$/m);
    expect(sql).toMatch(/^AS \$\$$/m);
  });

  it("does not over-escape regex literals", () => {
    // Under standard_conforming_strings=on '\\d' is a literal backslash + d,
    // so the start-month / phone / email patterns matched nothing real.
    expect(sql).not.toContain("\\\\d");
    expect(sql).not.toContain("\\\\s");
    expect(sql).not.toContain("\\\\D");
    expect(sql).toContain("'^\\d{4}-\\d{2}$'");
  });

  it("reads case_reference from cases, never from the invoice row", () => {
    // case_registration_invoices has no case_reference column; the payment RPCs
    // must join cases or the whole confirmation raises at runtime.
    const bodyOf = (name: string) => {
      const start = sql.indexOf(`FUNCTION public.${name}(`);
      expect(start).toBeGreaterThan(-1);
      const end = sql.indexOf("$$;", start);
      return sql.slice(start, end);
    };

    for (const fn of ["create_registration_card_payment_internal", "submit_registration_bank_transfer"]) {
      const body = bodyOf(fn);
      expect(body).toContain("v_invoice.case_reference");
      expect(body).toContain("SELECT i.*, c.case_reference INTO v_invoice");
      expect(body).toContain("JOIN public.cases c ON c.id = i.case_id");
    }
  });

  it("honours insurances.billing_period so a one_time premium is not multiplied", () => {
    expect(sql).toContain("v_insurance.billing_period");
    expect(sql).toContain("v_insurance_billing = 'monthly'");
  });

  it("treats the 'none' insurance sentinel as no insurance", () => {
    expect(sql).toContain("NULLIF(NULLIF(p_data->>'insurance_id',''),'none')::uuid");
  });

  it("allows a paid registration to enter profile_completion", () => {
    expect(sql).toContain("OLD.status = 'new' AND NEW.status = 'profile_completion'");
  });

  it("does not let an ordinary case skip the intake stages", () => {
    // The new -> profile_completion edge must be limited to cases that actually
    // came through this flow with a paid registration invoice; otherwise any
    // staff member could bypass contacted/appointment_scheduled on any case.
    const start = sql.indexOf("OLD.status = 'new' AND NEW.status = 'profile_completion'");
    const block = sql.slice(start, sql.indexOf("END IF;", start));
    expect(block).toContain("c.source = 'student_referral_registration'");
    expect(block).toContain("JOIN public.case_registration_invoices i ON i.case_id = c.id");
    expect(block).toContain("i.status = 'paid'");
    expect(block).toContain("public.has_role(auth.uid(), 'admin')");
    expect(block).toContain("c.assigned_to = auth.uid()");
  });

  it("records the insurance billing period on the invoice item", () => {
    expect(sql).toContain("'billing_period',v_insurance_billing");
  });

  it("exposes a school-scoped catalog RPC for students", () => {
    // programs/accommodations SELECT policies cover team_member and admin only.
    expect(sql).toContain("FUNCTION public.get_registration_catalog(p_school_id uuid)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_registration_catalog(uuid) TO authenticated");
  });
});

describe("complete direct registration workflow", () => {
  const sql = read(COMPLETE_MIGRATION);

  it("confirms a paid direct registration without creating a second DARB-service invoice", () => {
    expect(sql).toContain("FUNCTION public.confirm_direct_registration_profile(p_case_id uuid)");
    expect(sql).toContain("FUNCTION public.submit_student_referral_registration_for_review(p_case_id uuid)");
    expect(sql).toContain("source <> 'student_referral_registration'");
    expect(sql).toContain("payment_confirmed = true");
    expect(sql).toContain("SET status = 'submitted'");
    expect(sql).not.toContain("issue_case_invoice(");
  });

  it("routes enrollment rewards to the isolated student-referral reward path", () => {
    expect(sql).toContain("FUNCTION public.record_student_referral_registration_reward(p_case_id uuid)");
    expect(sql).toContain("'student_referral'");
    expect(sql).toContain("now() + interval '20 days'");
    expect(sql).toContain("NEW.source = 'student_referral_registration'");
    expect(sql).toContain("record_student_referral_registration_reward(NEW.id)");
  });

  it("lets paid direct registrations satisfy the enrollment finance gate", () => {
    expect(sql).toContain("FUNCTION public.assert_case_ready_for_enrollment(p_case_id uuid)");
    expect(sql).toContain("v_case.source = 'student_referral_registration'");
    expect(sql).toContain("'direct_registration'");
  });
});

describe("registration flow frontend", () => {
  it("loads the catalog through the RPC, not a direct table read", () => {
    const src = read(FLOW);
    expect(src).toContain('rpc("get_registration_catalog"');
    expect(src).not.toMatch(/\.from\("programs"\)/);
    expect(src).not.toMatch(/\.from\("accommodations"\)/);
  });

  it("selects public_token for history invoice links", () => {
    const src = read(FLOW);
    const historySelect = src.match(/from\("case_registration_invoices"\)[\s\S]{0,400}?\)/g) ?? [];
    expect(historySelect.some((s) => s.includes("public_token"))).toBe(true);
  });
});

describe("admin command center referral queue", () => {
  it("does not select a non-existent case_reference column", () => {
    const src = read(COMMAND_CENTER);
    const block = src.match(/from\('case_registration_invoices'\)[\s\S]{0,300}?;/)?.[0] ?? "";
    expect(block).not.toMatch(/select\('id,case_id,student_name,case_reference/);
    expect(block).toContain("cases(case_reference)");
  });
});

describe("direct registration admin surfaces", () => {
  it("loads real student referral rewards instead of only referral status", () => {
    const src = read("src/pages/admin/AdminReferralOperationsPage.tsx");
    expect(src).toContain('from("rewards")');
    expect(src).toContain('eq("reward_type", "student_referral")');
    expect(src).toContain("record.rewards.length");
  });

  it("uses RTL for both Arabic and Hebrew", () => {
    const src = read("src/pages/admin/AdminReferralOperationsPage.tsx");
    expect(src).toContain('i18n.language.startsWith("ar") || i18n.language.startsWith("he")');
  });
});
