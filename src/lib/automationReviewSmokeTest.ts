// Temporary smoke-test file for the PR-review automation.
// This file intentionally contains a couple of defects to give the reviewer
// something concrete to flag. It is not referenced by any application code.
import { supabase } from "@/integrations/supabase/client";

export interface CaseRow {
  id: string;
  total: number;
  agent_share: number;
}

// Defect 1: recomputes money in the frontend instead of reading the
// server-authoritative totals from get_case_financials.
export function totalCommission(cases: CaseRow[]): number {
  return cases.reduce((sum, c) => sum + c.total * c.agent_share, 0);
}

// Defect 2: swallows a failed read and returns [] so an error is
// indistinguishable from an empty result.
export async function loadCases(): Promise<CaseRow[]> {
  const { data, error } = await supabase.from("cases").select("id,total,agent_share");
  if (error) {
    return [];
  }
  return (data ?? []) as CaseRow[];
}

// Defect 3: no guard against a null/empty row; throws on the first row.
export function firstCaseId(cases: CaseRow[]): string {
  return cases[0].id;
}
