import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDateMedium } from "@/utils/dateUtils";

interface Props {
  caseData: Record<string, any>;
  /** Optional extra block (e.g. the finance summary once payment is done). */
  children?: React.ReactNode;
}


/**
 * Collapsed-by-default summary of where the case came from and what the
 * student told us on the apply form. Read-only.
 *
 * The "Referred by" row shows whoever DIRECTLY sent the student: a referring
 * student (referred_by) takes priority, otherwise it falls back to the
 * partner_id holder (agent self-referral, partner link, ambassador, or a
 * partner/ambassador recruited by an agent). Attribution, commissions, and
 * network KPIs are resolved entirely server-side and rendered in their own
 * dashboards — this panel only displays a name.
 */
export default function CaseOverviewPanel({ caseData }: Props) {
  const { t } = useTranslation("dashboard");
  const [open, setOpen] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    const ids = [caseData.partner_id, caseData.referred_by].filter(Boolean) as string[];
    if (ids.length === 0) return;
    // Team-member RLS on profiles only allows reading self / own students / admin-all,
    // so a direct .in("id", ids) silently misses partner_id / referred_by rows and
    // falls back to "Not set yet." Resolve via a SECURITY DEFINER RPC that returns
    // only (id, full_name) for non-deleted profiles, granted to authenticated.
    (supabase as any)
      .rpc("resolve_profile_names", { p_ids: ids })
      .then(({ data }: any) => {
        const find = (id?: string | null) =>
          id ? (data ?? []).find((p: any) => p.id === id)?.full_name ?? null : null;
        setPartnerName(find(caseData.partner_id));
        setReferrerName(find(caseData.referred_by));
      });
  }, [caseData.partner_id, caseData.referred_by]);


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
    // Show whoever directly sent the student — student referrer takes priority,
    // falls back to partner_id (agent self-referral, partner link, ambassador, etc.)
    { label: t("case.overview.referredBy"), value: referrerName ?? partnerName },
    { label: t("case.overview.createdAt"), value: formatDateMedium(caseData.created_at, null) },
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
