import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { ageFromDob, computeInsuranceCost } from "@/lib/insurancePricing";
import type { Tables } from "@/integrations/supabase/types";

interface CaseProgramTabProps {
  submission: Tables<"case_submissions"> | null;
  onRefresh?: () => void;
}

type InsuranceRow = Tables<"insurances">;

/** Program and accommodation are always quoted in euros by the schools. */
const PROGRAM_CURRENCY = "EUR";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US");
};

export default function CaseProgramTab({ submission }: CaseProgramTabProps) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language?.startsWith("ar");
  const [programName, setProgramName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [accommodationName, setAccommodationName] = useState<string | null>(null);
  const [insurance, setInsurance] = useState<InsuranceRow | null>(null);
  const [studentDob, setStudentDob] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const hasSubmission = submission !== null && submission !== undefined;
  const programId = submission?.program_id ?? null;
  const accommodationId = submission?.accommodation_id ?? null;
  const insuranceId = submission?.insurance_id ?? null;
  const caseId = submission?.case_id ?? null;

  useEffect(() => {
    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setLoadFailed(false);
      setProgramName(null);
      setSchoolName(null);
      setAccommodationName(null);
      setInsurance(null);
      setStudentDob(null);

      if (!hasSubmission) {
        if (!cancelled) setLoading(false);
        return;
      }

      let failed = false;
      /** `maybeSingle()` resolves with an error instead of throwing, so check every response. */
      const unwrap = <T,>(res: { data: T | null; error: { message: string } | null }, what: string) => {
        if (res.error) {
          failed = true;
          console.error(`Error loading ${what}:`, res.error.message);
          return null;
        }
        return res.data;
      };

      try {
        const [progRes, accomRes, insRes] = await Promise.all([
          programId
            ? supabase.from("programs").select("name_ar, name_en, school_id").eq("id", programId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          accommodationId
            ? supabase.from("accommodations").select("name_ar, name_en").eq("id", accommodationId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          insuranceId
            ? supabase.from("insurances").select("*").eq("id", insuranceId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const program = unwrap(progRes, "program");
        const accommodation = unwrap(accomRes, "accommodation");
        const insuranceRow = unwrap(insRes, "insurance");

        if (cancelled) return;

        if (program) {
          setProgramName((isAr ? program.name_ar : program.name_en) ?? program.name_en);
          if (program.school_id) {
            const schoolRes = await supabase
              .from("schools")
              .select("name_ar, name_en")
              .eq("id", program.school_id)
              .maybeSingle();
            const school = unwrap(schoolRes, "school");
            if (cancelled) return;
            if (school) setSchoolName((isAr ? school.name_ar : school.name_en) ?? school.name_en);
          }
        }

        if (accommodation) {
          setAccommodationName((isAr ? accommodation.name_ar : accommodation.name_en) ?? accommodation.name_en);
        }
        if (insuranceRow) setInsurance(insuranceRow);

        if (caseId) {
          // A case can have more than one linked profile, so take the first
          // rather than letting `maybeSingle()` fail the whole lookup.
          const profileRes = await supabase
            .from("profiles")
            .select("date_of_birth")
            .eq("case_id", caseId)
            .not("date_of_birth", "is", null)
            .limit(1);
          if (cancelled) return;
          if (profileRes.error) {
            failed = true;
            console.error("Error loading student date of birth:", profileRes.error.message);
          } else {
            setStudentDob(profileRes.data?.[0]?.date_of_birth ?? null);
          }
        }
      } catch (err) {
        failed = true;
        console.error("Error fetching program details:", err);
      } finally {
        if (!cancelled) {
          setLoadFailed(failed);
          setLoading(false);
        }
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [hasSubmission, programId, accommodationId, insuranceId, caseId, isAr]);

  if (loading) {
    return (
      <CardContent className="space-y-6 pt-6">
        <Skeleton className="h-20" />
      </CardContent>
    );
  }

  const studentAge = ageFromDob(studentDob);
  const cost = computeInsuranceCost(
    insurance,
    studentAge,
    submission?.program_start_date,
    submission?.program_end_date,
  );
  const months = cost.months;
  const insuranceMonthly = cost.monthly;
  const insuranceTotal = cost.total ?? (submission?.insurance_price || null);
  const insuranceCurrency = insurance?.currency ?? "EUR";
  const insuranceDescription = insurance ? (isAr ? insurance.description_ar : insurance.description_en) : null;
  const overMaxAge = insurance?.max_age != null && studentAge !== null && studentAge > insurance.max_age;
  const outsideTermRange =
    months !== null &&
    ((insurance?.min_months != null && months < insurance.min_months) ||
      (insurance?.max_months != null && months > insurance.max_months));

  return (
    <CardContent className="space-y-6 pt-6">
      {loadFailed && (
        <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t("case.program.loadError")}
        </p>
      )}

      {programName && (
        <div className="border-s-4 border-blue-500 ps-4 py-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase">{t("case.program.program")}</p>
          <p className="text-lg font-semibold text-foreground">{programName}</p>
          {schoolName && <p className="text-sm text-muted-foreground mt-1">{schoolName}</p>}
          {submission?.program_price ? (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {submission?.program_weeks && submission?.program_weekly_price
                  ? `${submission.program_weeks} × ${money(Number(submission.program_weekly_price), PROGRAM_CURRENCY)} = `
                  : ""}
                <span className="font-semibold text-foreground">
                  {money(Number(submission.program_price), PROGRAM_CURRENCY)}
                </span>
              </p>
              {!submission?.program_weeks && (
                <p className="text-xs text-amber-600">{t("case.program.unverifiedTotal")}</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {submission?.program_start_date && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">{t("case.program.startDate")}</p>
            <p className="text-sm font-medium">{formatDate(submission.program_start_date)}</p>
          </div>
          {submission?.program_end_date && (
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{t("case.program.endDate")}</p>
              <p className="text-sm font-medium">{formatDate(submission.program_end_date)}</p>
            </div>
          )}
          {months && (
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{t("case.program.duration")}</p>
              <p className="text-sm font-medium">{t("case.program.monthsCount", { count: months })}</p>
            </div>
          )}
        </div>
      )}

      {accommodationName && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">
            {t("case.program.accommodation")}
          </p>
          <p className="text-sm font-medium">{accommodationName}</p>
          {submission?.accommodation_price ? (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {submission?.accommodation_weeks && submission?.accommodation_weekly_price
                  ? `${submission.accommodation_weeks} × ${money(Number(submission.accommodation_weekly_price), PROGRAM_CURRENCY)} = `
                  : ""}
                <span className="font-semibold text-foreground">
                  {money(Number(submission.accommodation_price), PROGRAM_CURRENCY)}
                </span>
              </p>
              {!submission?.accommodation_weeks && (
                <p className="text-xs text-amber-600">{t("case.program.unverifiedTotal")}</p>
              )}
            </>
          ) : null}
        </div>
      )}

      {(insurance || submission?.insurance_price) && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase">{t("case.program.insurance")}</p>
          <p className="text-sm font-medium">
            {insurance?.name ?? t("case.program.insurance")}
            {insurance?.provider ? ` — ${insurance.provider}` : ""}
          </p>
          {insurance?.coverage_scope && (
            <p className="text-xs text-muted-foreground">{t(`admin.programs.coverage.${insurance.coverage_scope}`)}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {insuranceMonthly && months && cost.total !== null
              ? t("case.program.insuranceBreakdown", {
                  monthly: money(insuranceMonthly, insuranceCurrency),
                  months,
                  total: money(cost.total, insuranceCurrency),
                })
              : insuranceTotal
                ? money(Number(insuranceTotal), insuranceCurrency)
                : t("admin.programs.noPriceSet")}
          </p>
          {cost.tier && studentAge !== null && (
            <p className="text-xs text-muted-foreground">{t("case.program.ageBand", { age: studentAge })}</p>
          )}

          {(insurance?.min_months || insurance?.max_months || insurance?.max_age) && (
            <p className="text-xs text-muted-foreground">
              {insurance?.min_months && insurance?.max_months
                ? t("admin.programs.termRange", { min: insurance.min_months, max: insurance.max_months })
                : ""}
              {insurance?.max_age ? ` · ${t("admin.programs.maxAgeShort", { age: insurance.max_age })}` : ""}
            </p>
          )}
          {(overMaxAge || outsideTermRange) && (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {overMaxAge
                ? t("case.program.overMaxAge", { age: studentAge, max: insurance?.max_age })
                : t("case.program.outsideTermRange")}
            </p>
          )}
          {insuranceDescription && (
            <p className="text-xs text-muted-foreground leading-relaxed">{insuranceDescription}</p>
          )}
          {insurance?.terms_url && (
            <a
              href={insurance.terms_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t("admin.programs.viewTerms")}
            </a>
          )}
        </div>
      )}

      {!programName && !accommodationName && !insurance && (
        <p className="text-sm text-muted-foreground text-center py-6">{t("case.program.empty")}</p>
      )}
    </CardContent>
  );
}
