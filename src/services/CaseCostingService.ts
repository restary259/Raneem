import { supabase } from "@/integrations/supabase/client";

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

  // The `*_price` on the submission is the priced snapshot frozen when the
  // profile was saved (weekly rate × weeks). It is authoritative: we never
  // re-derive totals from the live catalogue, which can drift from what the
  // team actually quoted. When no snapshot exists the line is omitted rather
  // than fabricated.
  const programTotal = submission.program_price != null ? Number(submission.program_price) : null;
  if (progRes?.data && programTotal != null) {
    lines.push({
      label: `${labels.program} — ${pick(progRes.data)}`,
      amount: programTotal,
      currency: progRes.data.currency ?? "EUR",
    });
  }

  const accomTotal =
    submission.accommodation_price != null ? Number(submission.accommodation_price) : null;
  if (accomRes?.data && accomTotal != null) {
    lines.push({
      label: `${labels.accommodation} — ${pick(accomRes.data)}`,
      amount: accomTotal,
      currency: accomRes.data.currency ?? "EUR",
    });
  }

  if (insRes?.data) {
    const total = submission.insurance_price != null ? Number(submission.insurance_price) : null;
    if (total != null) {
      lines.push({
        label: `${labels.insurance} — ${insRes.data.name}`,
        amount: total,
        currency: insRes.data.currency ?? "EUR",
      });
    }
  }

  return lines;
}
