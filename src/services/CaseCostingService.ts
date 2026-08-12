import { supabase } from "@/integrations/supabase/client";
import { ageFromDob, computeInsuranceCost } from "@/lib/insurancePricing";


/**
 * Costing for a case.
 *
 * Shekel work (the agency service fee) becomes `case_services` rows so the
 * finance panel can track payments against them. Programme, accommodation and
 * insurance are billed by the schools in euro, so they are surfaced as
 * read-only breakdown lines instead of shekel services.
 */

export interface ProgrammeCostLine {
  label: string;
  amount: number;
  currency: string;
}

interface CostInput {
  submission: Record<string, any> | null;
  dateOfBirth?: string | null;
  isArabic: boolean;
  labels: {
    program: string;
    accommodation: string;
    insurance: string;
  };
}

/**
 * Fetch the euro programme costs attached to a case submission so they can be
 * shown next to the shekel totals.
 */
export async function loadProgrammeCosts({
  submission,
  dateOfBirth,
  isArabic,
  labels,
}: CostInput): Promise<ProgrammeCostLine[]> {
  if (!submission) return [];
  const lines: ProgrammeCostLine[] = [];

  const [progRes, accomRes, insRes] = await Promise.all([
    submission.program_id
      ? (supabase as any)
          .from("programs")
          .select("name_ar, name_en, price, currency, price_tiers")
          .eq("id", submission.program_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    submission.accommodation_id
      ? (supabase as any)
          .from("accommodations")
          .select("name_ar, name_en, price, currency, price_tiers")
          .eq("id", submission.accommodation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    submission.insurance_id
      ? (supabase as any).from("insurances").select("*").eq("id", submission.insurance_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const pick = (r: any) => (isArabic ? r?.name_ar || r?.name_en : r?.name_en || r?.name_ar) ?? "";

  /*
   * `*_price` on the submission is the TOTAL agreed with the student
   * (weekly rate × weeks), frozen when the file was saved. It is the only
   * figure we quote. A missing snapshot means the file was never priced —
   * we show zero rather than silently inventing a live catalogue price that
   * nobody agreed to.
   */
  const snapshot = (value: unknown) => (value == null ? 0 : Number(value));

  const programTotal = snapshot(submission.program_price);
  if (progRes?.data) {
    lines.push({
      label: `${labels.program} — ${pick(progRes.data)}`,
      amount: programTotal,
      currency: progRes.data.currency ?? "EUR",
    });
  }

  const accomTotal = snapshot(submission.accommodation_price);
  if (accomRes?.data) {
    lines.push({
      label: `${labels.accommodation} — ${pick(accomRes.data)}`,
      amount: accomTotal,
      currency: accomRes.data.currency ?? "EUR",
    });
  }

  if (insRes?.data) {
    /*
     * Insurance is priced from age and course dates, so recomputing is safe
     * and matches what the form displayed; the snapshot is the fallback.
     */
    const cost = computeInsuranceCost(
      insRes.data,
      ageFromDob(dateOfBirth ?? null),
      submission.program_start_date,
      submission.program_end_date,
    );
    lines.push({
      label: `${labels.insurance} — ${insRes.data.name}`,
      amount: cost.total ?? snapshot(submission.insurance_price),
      currency: insRes.data.currency ?? "EUR",
    });
  }


  return lines;
}
