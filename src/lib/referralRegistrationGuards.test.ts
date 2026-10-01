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

  it("drops every legacy registration RPC signature before replacing it", () => {
    // The live project has an out-of-band generation of these RPCs whose input
    // parameter NAMES differ (e.g. p_data vs p_payload, p_token vs
    // p_public_token). CREATE OR REPLACE cannot rename an input parameter, so
    // each colliding signature must be dropped first or the file aborts and no
    // payment RPC is ever created.
    const legacy = [
      "public.resolve_registration_weekly_rate(numeric, jsonb, integer)",
      "public.resolve_registration_insurance_monthly_rate(numeric, jsonb, integer)",
      "public.get_registration_catalog(uuid)",
      "public.create_student_referral_registration_internal(uuid, jsonb)",
      "public.get_registration_invoice_by_token(text)",
      "public.submit_registration_bank_transfer(text)",
      "public.create_registration_card_payment_internal(uuid)",
      "public.confirm_registration_payment(uuid, text)",
      "public.mark_registration_invoice_email(uuid, text, text)",
      "public.update_registration_payment_settings(text, text, text, text)",
      "public.confirm_registration_card_payment_internal(uuid, text, text)",
      "public.fail_registration_card_payment_internal(uuid, text, text)",
      "public.resolve_registration_insurance_monthly_rate(jsonb, integer)",
    ];
    for (const sig of legacy) {
      const dropIdx = sql.indexOf(`DROP FUNCTION IF EXISTS ${sig};`);
      const createIdx = sql.indexOf(`CREATE OR REPLACE FUNCTION ${sig.split("(")[0]}(`);
      expect(dropIdx, `missing DROP for ${sig}`).toBeGreaterThan(-1);
      expect(createIdx, `missing CREATE for ${sig}`).toBeGreaterThan(-1);
      expect(dropIdx, `DROP must precede CREATE for ${sig}`).toBeLessThan(createIdx);
    }
  });

  it("never references a non-existent cases.email column", () => {
    // `cases` has no email column (create-case-from-apply: "cases has no email
    // column"). Naming it raised 42703 at statement execution, which the
    // invalid_text_representation handler does not catch, so every
    // registration aborted before the INSERT was reached.
    expect(sql).not.toMatch(/\bc\.email\b/);

    const insertStart = sql.indexOf("INSERT INTO public.cases (");
    expect(insertStart).toBeGreaterThan(-1);
    const insertList = sql.slice(insertStart, sql.indexOf(")", insertStart));
    expect(insertList).not.toMatch(/\bemail\b/);

    // The applicant email is still persisted, on the mirror the rest of the
    // codebase reads, and the dedupe check matches on that mirror.
    expect(sql).toContain("student_email");
    expect(sql).toContain("LEFT JOIN public.case_submissions cs ON cs.case_id = c.id");
    expect(sql).toContain("lower(COALESCE(cs.student_email,'')) = v_email");
  });

  it("bridges the legacy registration-payment column names", () => {
    // CREATE TABLE IF NOT EXISTS is a no-op on the live table, which names the
    // invoice FK and the Stripe session differently. Without the reconcile
    // block every payment RPC raises 42703 at runtime.
    expect(sql).toContain("RENAME COLUMN registration_invoice_id TO invoice_id");
    expect(sql).toContain("RENAME COLUMN stripe_session_id TO provider_payment_id");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS invoice_id uuid");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS provider_payment_id text");

    // Everything after the bridge must use the canonical names only — a legacy
    // name leaking into a function body means that RPC still cannot run. Strip
    // line comments first so explanatory prose naming the old columns is fine.
    const afterReconcile = sql
      .slice(sql.indexOf("$reconcile$;") + "$reconcile$;".length)
      .replace(/--[^\n]*/g, "");
    expect(afterReconcile).not.toContain("registration_invoice_id");
    expect(afterReconcile).not.toContain("stripe_session_id");
    // `reference` is the canonical column the new RPCs read/write; the live
    // generation names it `payment_reference`, so it must be bridged too.
    expect(sql).toContain("RENAME COLUMN payment_reference TO reference");
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

describe("admin referral operations", () => {
  const PAGE = "src/pages/admin/AdminReferralOperationsPage.tsx";

  it("does not select cases.email (the column does not exist)", () => {
    const src = read(PAGE);
    // The queue read joins cases; naming email there makes PostgREST return a
    // 400 and the catch renders an empty Referral Operations page.
    const casesSelect = src.match(/from\("cases"\)\.select\("([^"]*)"\)/)?.[1] ?? "";
    expect(casesSelect.length).toBeGreaterThan(0);
    expect(casesSelect.split(",")).not.toContain("email");
  });
});
