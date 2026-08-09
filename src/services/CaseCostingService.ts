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

/**
 * Create the shekel service lines for a case from the admin service catalog.
 * Idempotent: does nothing when the case already has services attached.
 */
export async function ensureCaseServices(caseId: string, actorId?: string | null): Promise<void> {
  const { data: existing, error: existingErr } = await (supabase as any)
    .from("case_services")
    .select("id")
    .eq("case_id", caseId)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) return;

  const { data: catalog, error: catalogErr } = await (supabase as any)
    .from("service_catalog")
    .select("id, name_ar, name_en, category, default_price, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (catalogErr) throw catalogErr;
  if (!catalog?.length) return;

  const rows = catalog.map((s: any) => ({
    case_id: caseId,
    service_id: s.id,
    description: s.name_ar || s.name_en,
    category: s.category,
    unit_price: Number(s.default_price ?? 0),
    quantity: 1,
    discount: 0,
    added_by: actorId ?? null,
  }));

  const { error } = await (supabase as any).from("case_services").insert(rows);
  if (error) throw error;
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
          .select("name_ar, name_en, price, currency")
          .eq("id", submission.program_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    submission.accommodation_id
      ? (supabase as any)
          .from("accommodations")
          .select("name_ar, name_en, price, currency")
          .eq("id", submission.accommodation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    submission.insurance_id
      ? (supabase as any).from("insurances").select("*").eq("id", submission.insurance_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const pick = (r: any) => (isArabic ? r?.name_ar || r?.name_en : r?.name_en || r?.name_ar) ?? "";

  // `*_price` on the submission is the TOTAL (weekly rate × weeks). Only when
  // it is missing do we fall back to deriving it from the catalogue tiers.
  const programTotal =
    submission.program_price != null
      ? Number(submission.program_price)
      : computeWeeklyCost(progRes?.data, submission.program_weeks).total;
  if (progRes?.data && programTotal) {
    lines.push({
      label: `${labels.program} — ${pick(progRes.data)}`,
      amount: programTotal,
      currency: progRes.data.currency ?? "EUR",
    });
  }

  const accomTotal =
    submission.accommodation_price != null
      ? Number(submission.accommodation_price)
      : computeWeeklyCost(accomRes?.data, submission.accommodation_weeks).total;
  if (accomRes?.data && accomTotal) {
    lines.push({
      label: `${labels.accommodation} — ${pick(accomRes.data)}`,
      amount: accomTotal,
      currency: accomRes.data.currency ?? "EUR",
    });
  }


  if (insRes?.data) {
    const cost = computeInsuranceCost(
      insRes.data,
      ageFromDob(dateOfBirth ?? null),
      submission.program_start_date,
      submission.program_end_date,
    );
    const total = cost.total ?? (submission.insurance_price ? Number(submission.insurance_price) : null);
    if (total) {
      lines.push({
        label: `${labels.insurance} — ${insRes.data.name}`,
        amount: total,
        currency: insRes.data.currency ?? "EUR",
      });
    }
  }

  return lines;
}
