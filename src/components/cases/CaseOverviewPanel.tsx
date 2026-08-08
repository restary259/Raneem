import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  caseData: Record<string, any>;
  /** Optional extra block (e.g. the finance summary once payment is done). */
  children?: React.ReactNode;
}


/**
 * Collapsed-by-default summary of where the case came from and what the
 * student told us on the apply form. Read-only.
 */
export default function CaseOverviewPanel({ caseData }: Props) {
  const { t } = useTranslation("dashboard");
  const [open, setOpen] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    const ids = [caseData.partner_id, caseData.referred_by].filter(Boolean) as string[];
    if (ids.length === 0) return;
    (supabase as any)
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .then(({ data }: any) => {
        const find = (id?: string | null) =>
          id ? (data ?? []).find((p: any) => p.id === id)?.full_name ?? null : null;
        setPartnerName(find(caseData.partner_id));
        setReferrerName(find(caseData.referred_by));
      });
  }, [caseData.partner_id, caseData.referred_by]);

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null;

  const rows: { label: string; value: string | null }[] = [
    { label: t("case.overview.phone"), value: caseData.phone_number ?? null },
    { label: t("case.fields.city"), value: caseData.city ?? null },
    {
      label: t("case.overview.educationLevel"),
      value: caseData.education_level
        ? t(`case.education.${caseData.education_level}`, caseData.education_level)
        : null,
    },
    { label: t("case.overview.passportType"), value: caseData.passport_type ?? null },
    { label: t("case.overview.degreeInterest"), value: caseData.degree_interest ?? null },
    { label: t("case.overview.bagrut"), value: caseData.bagrut_score ? String(caseData.bagrut_score) : null },
    {
      label: t("case.overview.englishUnits"),
      value: caseData.english_units ? String(caseData.english_units) : null,
    },
    { label: t("case.overview.mathUnits"), value: caseData.math_units ? String(caseData.math_units) : null },
    { label: t("case.overview.intake"), value: caseData.intake_notes ?? null },
    {
      label: t("case.overview.source"),
      value: caseData.source ? t(`case.source.${caseData.source}`, caseData.source) : null,
    },
    { label: t("case.overview.partner"), value: partnerName },
    { label: t("case.overview.referredBy"), value: referrerName },
    { label: t("case.overview.createdAt"), value: fmtDate(caseData.created_at) },
  ];

  const notSet = t("case.overview.notSet");

  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start sm:px-5"
      >
        <span className="text-sm font-medium">{t("case.overview.title")}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t px-4 py-4 sm:grid-cols-3 sm:px-5">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="mb-0.5 text-[11px] text-muted-foreground">{row.label}</p>
              <p className={cn("text-sm", row.value ? "text-foreground" : "text-muted-foreground")}>
                {row.value ?? notSet}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
