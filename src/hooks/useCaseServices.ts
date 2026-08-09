import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";

export type PricingModel = "fixed" | "per_week" | "per_month" | "per_person" | "quantity";

export interface CatalogService {
  id: string;
  code: string | null;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  category: string;
  default_price: number;
  currency: string;
  pricing_model: PricingModel;
  default_quantity: number;
  allows_quantity: boolean;
  commissionable: boolean;
  is_optional: boolean;
  school_id: string | null;
  program_id: string | null;
  accommodation_id: string | null;
  version: number;
  is_active: boolean;
  /** Part of the "Full Service" bundle — configured by admins in service settings. */
  in_full_service: boolean;
  sort_order: number;
}

export interface CaseService {
  id: string;
  case_id: string;
  service_id: string | null;
  description: string;
  category: string;
  unit_price: number;
  quantity: number;
  discount: number;
  currency: string;
  pricing_model: PricingModel;
  catalog_version: number | null;
  commissionable: boolean;
  notes: string | null;
  created_at: string;
}

/** The service categories the admin catalog supports. */
export const SERVICE_CATEGORIES = [
  "language_course",
  "accommodation",
  "insurance",
  "sim_card",
  "bank_account",
  "university_registration",
  "translation",
  "notarization",
  "documents",
  "visa_support",
  "transportation",
  "other",
] as const;

export const PRICING_MODELS: PricingModel[] = ["fixed", "per_week", "per_month", "per_person", "quantity"];

export function caseServiceTotal(s: Pick<CaseService, "unit_price" | "quantity" | "discount">) {
  return Number(s.unit_price || 0) * Number(s.quantity || 0) - Number(s.discount || 0);
}

export function useServiceCatalog() {
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error: err } = await (supabase as any)
      .from("service_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    if (err) {
      setError(err.message);
      setCatalog([]);
    } else {
      setError(null);
      setCatalog((data ?? []) as CatalogService[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { catalog, isLoading, error, refetch };
}

export function useCaseServices(caseId: string | undefined) {
  const [services, setServices] = useState<CaseService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { financials } = useCaseFinancials(caseId);

  const refetch = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("case_services")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    setServices((data ?? []) as CaseService[]);
    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const total = Number(financials?.service_total ?? 0);

  return { services, total, isLoading, refetch };
}

/**
 * The authoritative course length (A1 → C1). Admins configure it once in
 * platform settings; nothing in the app may hard-code the number of weeks.
 */
export function useDefaultCourseWeeks(fallback = 40) {
  const [weeks, setWeeks] = useState<number>(fallback);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("default_course_weeks")
        .limit(1)
        .maybeSingle();
      if (alive && data?.default_course_weeks) setWeeks(Number(data.default_course_weeks));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return weeks;
}
