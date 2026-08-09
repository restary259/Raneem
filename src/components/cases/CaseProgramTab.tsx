import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { ageFromDob, computeInsuranceCost } from "@/lib/insurancePricing";


interface CaseProgramTabProps {
  submission: any;
  onRefresh: () => void;
}

interface InsuranceInfo {
  name: string;
  provider: string | null;
  currency: string;
  price: number;
  coverage_scope: string | null;
  billing_period: string | null;
  min_months: number | null;
  max_months: number | null;
  max_age: number | null;
  terms_url: string | null;
  description_ar: string | null;
  description_en: string | null;
}




const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-US") : "";

export default function CaseProgramTab({ submission }: CaseProgramTabProps) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language?.startsWith("ar");
  const [programName, setProgramName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [accommodationName, setAccommodationName] = useState<string | null>(null);
  const [insurance, setInsurance] = useState<InsuranceInfo | null>(null);
  const [studentDob, setStudentDob] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchDetails = async () => {
      if (!submission) {
        setLoading(false);
        return;
      }

      try {
        const [progRes, accomRes, insRes] = await Promise.all([
          submission.program_id
            ? supabase.from("programs").select("name_ar, name_en, school_id").eq("id", submission.program_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          submission.accommodation_id
            ? supabase.from("accommodations").select("name_ar, name_en").eq("id", submission.accommodation_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
          submission.insurance_id
            ? (supabase as any).from("insurances").select("*").eq("id", submission.insurance_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);

        if (progRes.data) {
          setProgramName((isAr ? progRes.data.name_ar : progRes.data.name_en) ?? progRes.data.name_en);
          if (progRes.data.school_id) {
            const schoolRes = await supabase
              .from("schools")
              .select("name_ar, name_en")
              .eq("id", progRes.data.school_id)
              .maybeSingle();
            if (schoolRes.data) {
              setSchoolName((isAr ? schoolRes.data.name_ar : schoolRes.data.name_en) ?? schoolRes.data.name_en);
            }
          }
        }

        if (accomRes.data) {
          setAccommodationName((isAr ? accomRes.data.name_ar : accomRes.data.name_en) ?? accomRes.data.name_en);
        }

        if (insRes.data) setInsurance(insRes.data as InsuranceInfo);

        if (submission.case_id) {
          const profileRes = await (supabase as any)
            .from("profiles")
            .select("date_of_birth")
            .eq("case_id", submission.case_id)
            .maybeSingle();
          if (profileRes?.data?.date_of_birth) setStudentDob(profileRes.data.date_of_birth);
        }

      } catch (err) {
        console.error("Error fetching program details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [submission, isAr]);

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
  const symbol = insuranceCurrency === "EUR" ? "€" : "₪";
  const insuranceDescription = insurance ? (isAr ? insurance.description_ar : insurance.description_en) : null;


  return (
    <CardContent className="space-y-6 pt-6">
      {programName && (
        <div className="border-s-4 border-blue-500 ps-4 py-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase">{t("case.program.program")}</p>
          <p className="text-lg font-semibold text-foreground">{programName}</p>
          {schoolName && <p className="text-sm text-muted-foreground mt-1">{schoolName}</p>}
          {submission?.program_price ? (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                {submission?.program_weeks && submission?.program_weekly_price
                  ? `${submission.program_weeks} × €${Number(submission.program_weekly_price).toLocaleString("en-US")} = `
                  : ""}
                <span className="font-semibold text-foreground">
                  €{Number(submission.program_price).toLocaleString("en-US")}
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
            <p className="text-sm text-muted-foreground mt-1">
              {submission?.accommodation_weeks && submission?.accommodation_weekly_price
                ? `${submission.accommodation_weeks} × €${Number(submission.accommodation_weekly_price).toLocaleString("en-US")} = `
                : ""}
              <span className="font-semibold text-foreground">
                €{Number(submission.accommodation_price).toLocaleString("en-US")}
              </span>
            </p>
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
            {insuranceMonthly && months
              ? t("case.program.insuranceBreakdown", {
                  monthly: `${symbol}${insuranceMonthly.toLocaleString("en-US")}`,
                  months,
                  total: `${symbol}${Number(insuranceTotal ?? 0).toLocaleString("en-US")}`,
                })
              : insuranceTotal
                ? `${symbol}${Number(insuranceTotal).toLocaleString("en-US")}`
                : t("admin.programs.noPriceSet")}
          </p>
          {cost.tier && studentAge !== null && (
            <p className="text-xs text-muted-foreground">
              {t("case.program.ageBand", { age: studentAge })}
            </p>
          )}

          {(insurance?.min_months || insurance?.max_months || insurance?.max_age) && (
            <p className="text-xs text-muted-foreground">
              {insurance?.min_months && insurance?.max_months
                ? t("admin.programs.termRange", { min: insurance.min_months, max: insurance.max_months })
                : ""}
              {insurance?.max_age ? ` · ${t("admin.programs.maxAgeShort", { age: insurance.max_age })}` : ""}
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
