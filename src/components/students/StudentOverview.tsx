import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpRight,
  Mail,
  Phone,
  MessageCircle,
  User,
  Globe,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  School,
  GraduationCap,
  Hash,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePipelineStatuses } from "@/hooks/usePipelineStatuses";
import { useCaseFinancials, type CaseFinancials } from "@/hooks/useCaseFinancials";
import { statusColorClasses } from "@/lib/caseStatus";
import { whatsappUrl, normalizePhone, isLinkablePhone } from "@/lib/phone";
import { formatILS } from "@/lib/money";
import { readStudentProfile, missingProfileFields } from "@/lib/studentProfileFields";
import CaseProgressRail from "@/components/cases/CaseProgressRail";
import CaseProfileSummary from "@/components/cases/CaseProfileSummary";

export interface VisaField {
  id: string;
  field_key?: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: any[] | null;
}

export interface StudentOverviewProps {
  /** student account (profile) row */
  profile: Record<string, unknown>;
  /** linked case row, or null for a standalone student */
  caseData: Record<string, unknown> | null;
  /** linked case_submissions row, if any */
  submission: Record<string, unknown> | null;
  /** "page" = two-column (team route); "sheet" = single-column (admin sheet) */
  variant?: "page" | "sheet";
  /** Override for the "open case" deep link (admin passes its own). */
  caseHref?: (caseId: string) => string;
  /** Override for the "open finance" deep link. */
  financeHref?: (caseId: string) => string;
  /** Render the visa tab contents (read-only for team, editable for admin). */
  renderVisaTab?: () => React.ReactNode;
  /** Render the documents tab contents (admin upload/list). Optional. */
  renderDocumentsTab?: () => React.ReactNode;
  /** Restrict which info tabs render. Defaults to personal/contact/visa (+documents when provided). */
  tabs?: ("personal" | "contact" | "visa" | "documents")[];
}

type NextAction = {
  title: string;
  detail: string;
  href: string | null;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Shared student "overview" command-center consumed by the team student
 * profile page and the admin students sheet. Composes existing components
 * (CaseProgressRail, CaseProfileSummary) and reads money from the
 * authoritative `get_case_financials` RPC via useCaseFinancials — the
 * frontend never re-adds prices, so displayed totals always match the case
 * Finance tab.
 *
 * Layout (top → bottom): Student information → Case progress → Next action
 * + Financial snapshot → Detail tabs (Personal / Contact / Visa /
 * Documents). Recent activity is intentionally NOT shown here — it lives on
 * the case detail timeline.
 *
 * Graceful degradation: when `caseData` is null (standalone student with no
 * linked case) the progress rail / next-action / financial-snapshot sections
 * are hidden and only the detail tabs remain.
 */
export default function StudentOverview({
  profile,
  caseData,
  submission,
  variant = "page",
  caseHref,
  financeHref,
  renderVisaTab,
  renderDocumentsTab,
  tabs,
}: StudentOverviewProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  const caseId = caseData?.id as string | undefined;
  const hasCase = !!caseData && !!caseId;

  const { statuses } = usePipelineStatuses();
  const { financials, isLoading: finLoading } = useCaseFinancials(hasCase ? caseId : undefined);

  // Resolve display names for the compact info header: the assigned team
  // member (cases.assigned_to → profiles), the program (case_submissions
  // .program_id → programs) and the language school (profiles
  // .language_school_id → schools, used only when university_name isn't
  // already carrying the synced display name). All from existing tables —
  // no new data source.
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const assignedTo = caseData?.assigned_to as string | null | undefined;
    const programId = submission?.program_id as string | null | undefined;
    const languageSchoolId = profile.language_school_id as string | null | undefined;
    const hasSchoolDisplay = !!(profile.university_name as string | null | undefined);

    type NameRow = { name_en: string | null; name_ar: string | null } | null;
    type ProfileRow = { full_name: string | null; email: string | null } | null;
    const empty = { data: null } as { data: null };

    (async () => {
      const [assignedRes, programRes, schoolRes] = await Promise.all([
        assignedTo
          ? supabase.from("profiles").select("full_name, email").eq("id", assignedTo).maybeSingle()
          : Promise.resolve(empty as { data: ProfileRow }),
        programId
          ? supabase.from("programs").select("id, name_en, name_ar").eq("id", programId).maybeSingle()
          : Promise.resolve(empty as { data: NameRow }),
        !hasSchoolDisplay && languageSchoolId
          ? supabase.from("schools").select("id, name_en, name_ar").eq("id", languageSchoolId).maybeSingle()
          : Promise.resolve(empty as { data: NameRow }),
      ]);
      if (cancelled) return;
      const prefer = (r: NameRow) =>
        r ? (isAr ? r.name_ar || r.name_en : r.name_en || r.name_ar) || "" : "";
      const assigned = assignedRes.data as ProfileRow;
      setAssignedName(assigned ? assigned.full_name || assigned.email || null : null);
      setProgramName(prefer(programRes.data as NameRow) || null);
      setSchoolName(prefer(schoolRes.data as NameRow) || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseData?.assigned_to, submission?.program_id, profile.language_school_id, profile.university_name, isAr]);

  // Visa fields/values for the read-only Visa tab (team). Admin supplies its
  // own editable renderer via renderVisaTab.
  const [visaFields, setVisaFields] = useState<VisaField[]>([]);
  const [visaValues, setVisaValues] = useState<Record<string, string>>({});
  const [visaLoading, setVisaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const uid = profile.id as string | undefined;
    if (!uid) {
      setVisaLoading(false);
      return;
    }
    (async () => {
      const [fieldsRes, valuesRes] = await Promise.all([
        (supabase as any)
          .from("visa_fields")
          .select("id, field_key, label_en, label_ar, field_type, options_json")
          .eq("is_active", true)
          .order("display_order"),
        (supabase as any)
          .from("visa_field_values")
          .select("id, field_id, value")
          .eq("student_user_id", uid),
      ]);
      if (cancelled) return;
      setVisaFields((fieldsRes.data as VisaField[]) ?? []);
      const valMap: Record<string, string> = {};
      (valuesRes.data ?? []).forEach((v: any) => { valMap[v.field_id] = v.value ?? ""; });
      setVisaValues(valMap);
      setVisaLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile.id]);

  const statusKey = (caseData?.status as string) ?? null;
  const statusLabel = statusKey ? t(`case.status.${statusKey}`, { defaultValue: statusKey.replace(/_/g, " ") }) : null;
  const statusClass = statusKey ? statusColorClasses(statuses.find((s) => s.key === statusKey)?.color) : "";

  const phone = (caseData?.phone_number ?? profile.phone_number) as string | null;
  const email = profile.email as string | null;
  const fullName = (profile.full_name as string) || email || "—";
  const caseRef = caseData?.case_reference as string | null;

  const openCase = caseId ? (caseHref ? caseHref(caseId) : `/team/cases/${caseId}`) : null;
  const openFinance = caseId ? (financeHref ? financeHref(caseId) : `/team/cases/${caseId}`) : null;

  const waHref = isLinkablePhone(phone) ? whatsappUrl(phone) : null;

  // ── Next action derivation (status + profile completeness + finance) ──
  // Only UNFINISHED work is surfaced. Terminal success/cancelled states have
  // nothing outstanding, so no next-action card is shown for them.
  const nextAction: NextAction | null = (() => {
    if (!hasCase) return null;
    const status = statusKey;
    if (status === "enrollment_paid" || status === "cancelled") return null;
    const profileValues = readStudentProfile(caseData!, submission);
    const missing = missingProfileFields(profileValues);
    if (status === "profile_completion" || (status && ["new", "contacted", "appointment_scheduled"].includes(status) && missing.length > 0)) {
      return {
        title: t("studentOverview.profileIncomplete", "Profile incomplete"),
        detail: t("student.next.completeProfileDetail", "Date of birth and emergency contact are required."),
        href: openCase,
        cta: t("studentOverview.goToProfile", "Go to profile"),
        icon: User,
      };
    }
    if (status === "payment_confirmed") {
      return {
        title: t("student.next.outstandingBalance", "Outstanding balance"),
        detail: financials ? formatILS(financials.remaining) : "—",
        href: openFinance,
        cta: t("studentOverview.goToPayment", "Go to payment"),
        icon: CreditCard,
      };
    }
    if (status === "submitted") {
      return {
        title: t("student.next.prepareVisa", "Prepare your visa file"),
        detail: t("student.next.prepareVisaDetail", "Fill in the visa form fields and upload the required proofs."),
        href: openCase,
        cta: t("studentOverview.openCase", "Open case"),
        icon: Globe,
      };
    }
    return {
      title: t("case.progressLabel", "Case progress"),
      detail: statusLabel ?? status ?? "",
      href: openCase,
      cta: t("studentOverview.openCase", "Open case"),
      icon: FileText,
    };
  })();

  const Chevron = isAr ? ChevronLeft : ChevronRight;
  const twoCol = variant === "page";

  const initials = (fullName || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const tabCount = renderDocumentsTab ? 4 : 3;
  const showTab = (key: "personal" | "contact" | "visa" | "documents") =>
    !tabs || tabs.includes(key);
  const showDocsTab = showTab("documents") && (!!renderDocumentsTab || tabs?.includes("documents"));
  const effectiveTabCount = (showTab("personal") ? 1 : 0) + (showTab("contact") ? 1 : 0) + (showTab("visa") ? 1 : 0) + (showDocsTab ? 1 : 0);
  const defaultTab = showTab("personal") ? "personal" : showTab("contact") ? "contact" : showTab("visa") ? "visa" : "documents";

  return (
    <div className="space-y-4">
      {/* ── Student information (who is this student?) ──────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{fullName}</h2>
                {statusLabel && (
                  <Badge variant="outline" className={`shrink-0 ${statusClass}`}>{statusLabel}</Badge>
                )}
                {!hasCase && (
                  <Badge variant="secondary" className="shrink-0">{t("studentOverview.noLinkedCase", "No linked case")}</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {caseRef && <span className="flex items-center gap-1 font-medium text-foreground"><Hash className="h-3 w-3" />{caseRef}</span>}
                {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
              </div>

              {/* Compact key facts — real fields from the profile / case /
                  submission. Only rendered when the value is present. */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <InfoRow icon={School} label={t("studentOverview.languageSchool", "Language school")} value={(profile.university_name as string) || schoolName} />
                <InfoRow icon={GraduationCap} label={t("studentOverview.program", "Program")} value={programName} />
                <InfoRow icon={UserCheck} label={t("studentOverview.assignedTeamMember", "Assigned team member")} value={assignedName} />
                <InfoRow icon={FileText} label={t("studentOverview.caseStatus", "Case status")} value={statusLabel} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {openCase && (
                  <Button size="sm" variant="default" className="gap-1.5" onClick={() => navigate(openCase)}>
                    <FileText className="h-3.5 w-3.5" />
                    {t("studentOverview.openCase", "Open case")}
                  </Button>
                )}
                {waHref && (
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {isAr ? "واتساب" : "WhatsApp"}
                    </a>
                  </Button>
                )}
                {phone && (
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={`tel:+${normalizePhone(phone)}`}>
                      <Phone className="h-3.5 w-3.5" />
                      {t("student.overview.callUs", "Call us")}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Case progress ────────────────────────────────────────────── */}
      {hasCase && (
        <Card>
          <CardContent className="p-4">
            <CaseProgressRail statuses={statuses} currentKey={statusKey ?? ""} />
          </CardContent>
        </Card>
      )}

      {/* ── Next action + Financial snapshot ─────────────────────────── */}
      {hasCase && nextAction && (
        <div className={twoCol ? "grid gap-4 md:grid-cols-2" : "grid gap-4 grid-cols-1"}>
          {/* Next action */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("studentOverview.nextAction", "Next action")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const Icon = nextAction.icon;
                return (
                  <div className="flex items-start gap-3">
                    <div className="inline-flex p-2 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{nextAction.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{nextAction.detail}</p>
                      {nextAction.href && (
                        <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1" onClick={() => navigate(nextAction.href!)}>
                          {nextAction.cta}
                          <Chevron className="h-3.5 w-3.5 rtl:rotate-180" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Financial snapshot */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t("studentOverview.financialSnapshot", "Financial snapshot")}
              </CardTitle>
              {openFinance && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate(openFinance)}>
                  {t("studentOverview.openFinance", "Open finance")}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {finLoading ? (
                <div className="py-4 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : financials ? (
                <FinancialSnapshot fin={financials} isAr={isAr} t={t} />
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Detail tabs ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t("studentOverview.details", "Details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue={defaultTab}>
            {effectiveTabCount > 1 && (
              <TabsList className="grid h-auto w-full" style={{ gridTemplateColumns: `repeat(${effectiveTabCount}, minmax(0,1fr))` }}>
                {showTab("personal") && <TabsTrigger value="personal" className="text-xs">{t("studentOverview.personal", "Personal")}</TabsTrigger>}
                {showTab("contact") && <TabsTrigger value="contact" className="text-xs">{t("studentOverview.contact", "Contact")}</TabsTrigger>}
                {showTab("visa") && <TabsTrigger value="visa" className="text-xs">{t("studentOverview.visa", "Visa")}</TabsTrigger>}
                {showDocsTab && <TabsTrigger value="documents" className="text-xs">{t("studentOverview.documents", "Documents")}</TabsTrigger>}
              </TabsList>
            )}
            {showTab("personal") && (
              <TabsContent value="personal" className="mt-3">
                {hasCase ? (
                  <CaseProfileSummary caseData={caseData!} submission={submission} />
                ) : (
                  <StandaloneProfile profile={profile} isAr={isAr} />
                )}
              </TabsContent>
            )}
            {showTab("contact") && (
              <TabsContent value="contact" className="mt-3">
                <ContactRows profile={profile} caseData={caseData} isAr={isAr} />
              </TabsContent>
            )}
            {showTab("visa") && (
              <TabsContent value="visa" className="mt-3">
                {renderVisaTab ? renderVisaTab() : <VisaReadOnly fields={visaFields} values={visaValues} loading={visaLoading} isAr={isAr} t={t} />}
              </TabsContent>
            )}
            {showDocsTab && (
              <TabsContent value="documents" className="mt-3">
                {renderDocumentsTab?.()}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Compact labelled row for the student information header ──────────── */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

/* ── Financial snapshot: ILS DARB totals only; EUR school costs separate ── */
function FinancialSnapshot({
  fin,
  isAr,
  t,
}: {
  fin: CaseFinancials;
  isAr: boolean;
  t: TFunction<"dashboard">;
}) {
  const eurCosts = (fin.school_costs ?? []).filter((c) => c.currency === "EUR");
  const hasDiscount = (fin.referral_discount ?? 0) > 0;
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between py-1">
      <span className={`text-xs ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{value}</span>
    </div>
  );
  return (
    <div className="space-y-0.5">
      {hasDiscount && row(t("studentOverview.serviceTotal", "Service total"), formatILS(fin.service_total + fin.referral_discount))}
      {hasDiscount && (
        <div className="flex items-center justify-between py-1 rounded-md bg-emerald-500/10 px-2 -mx-2">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {isAr ? "− خصم الإحالة" : "− Referral discount"}
          </span>
          <span className="text-sm tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
            {formatILS(fin.referral_discount)}
          </span>
        </div>
      )}
      {row(t("studentOverview.finalTotal", "Final total"), formatILS(fin.service_total), true)}
      {row(t("finance.summary.paid", "Paid"), formatILS(fin.total_confirmed))}
      {row(t("finance.summary.remaining", "Remaining"), formatILS(fin.remaining), true)}
      {eurCosts.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {t("studentOverview.schoolCosts", "School costs (€)")}
          </p>
          {eurCosts.map((c, i) => (
            <div key={`${c.kind}-${i}`}>
              {row(`${(isAr ? c.name_ar : c.name_en) ?? c.kind}`, `${c.total.toFixed(0)} €`)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Read-only visa field rendering (team overview) ──────────────────── */
function VisaReadOnly({
  fields,
  values,
  loading,
  isAr,
  t,
  profile,
}: {
  fields: VisaField[];
  values: Record<string, string>;
  loading: boolean;
  isAr: boolean;
  t: TFunction<"dashboard">;
  profile?: Record<string, unknown> | null;
}) {
  if (loading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const yesNo = (v: unknown) => (v === true ? (isAr ? "نعم" : "لا".replace("لا", "نعم")) : null);
  // Profile-level immigration answers the student fills on their Visa page.
  const profileRows: { label: string; value: string | null }[] = profile
    ? [
        { label: isAr ? "انتهاء الجواز" : "Passport expiry", value: (profile.passport_expiry as string) ?? null },
        { label: isAr ? "تاريخ الوصول" : "Planned arrival", value: (profile.arrival_date as string) ?? null },
        { label: isAr ? "لون العيون" : "Eye color", value: (profile.eye_color as string) ?? null },
        {
          label: isAr ? "تغيير الاسم القانوني" : "Changed legal name",
          value: profile.has_changed_legal_name
            ? (profile.previous_legal_name as string) || (isAr ? "نعم" : "Yes")
            : null,
        },
        {
          label: isAr ? "سجل جنائي" : "Criminal record",
          value: profile.has_criminal_record
            ? (profile.criminal_record_details as string) || (isAr ? "نعم" : "Yes")
            : null,
        },
        {
          label: isAr ? "جنسية مزدوجة" : "Dual citizenship",
          value: profile.has_dual_citizenship
            ? (profile.second_passport_country as string) || (isAr ? "نعم" : "Yes")
            : null,
        },
      ].filter((r) => !!r.value)
    : [];

  const hasDynamic = fields.length > 0 && fields.some((f) => values[f.id]);

  if (!hasDynamic && profileRows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{t("visa.noData", "No visa information on file yet.")}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {fields.map((f) => {
        const label = isAr ? f.label_ar : f.label_en;
        const raw = values[f.id] ?? "";
        if (!raw) return null;
        let display = raw;
        if (f.field_type === "boolean") display = raw === "true" ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No");
        else if (f.field_type === "select" && Array.isArray(f.options_json)) {
          const opt = (f.options_json as any[]).find((o) => (o.value ?? o) === raw);
          display = opt ? (isAr ? opt.ar : opt.en) ?? raw : raw;
        }
        return (
          <div key={f.id} className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground break-words">{display}</p>
          </div>
        );
      })}
      {profileRows.map((r) => (
        <div key={r.label} className="min-w-0">
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground break-words">{r.value}</p>
        </div>
      ))}
    </div>
  );
}


/* ── Contact rows (fallback / standalone) ────────────────────────────── */
function ContactRows({
  profile,
  caseData,
  isAr,
}: {
  profile: Record<string, unknown>;
  caseData: Record<string, unknown> | null;
  isAr: boolean;
}) {
  const rows = [
    { label: isAr ? "البريد الإلكتروني" : "Email", value: profile.email as string | null },
    { label: isAr ? "الهاتف" : "Phone", value: (caseData?.phone_number ?? profile.phone_number) as string | null },
    { label: isAr ? "المدينة" : "City", value: profile.city as string | null },
    { label: isAr ? "الدولة" : "Country", value: profile.country as string | null },
    { label: isAr ? "مدرسة اللغة" : "Language school", value: profile.university_name as string | null },
    { label: isAr ? "جهة اتصال الطوارئ" : "Emergency contact", value: profile.emergency_contact_phone as string | null },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground break-words">{r.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Minimal profile summary for a standalone student (no case) ───────── */
function StandaloneProfile({ profile, isAr }: { profile: Record<string, unknown>; isAr: boolean }) {
  const rows = [
    { label: isAr ? "الاسم الكامل" : "Full name", value: profile.full_name as string | null },
    { label: isAr ? "تاريخ الميلاد" : "Date of birth", value: profile.date_of_birth as string | null },
    { label: isAr ? "الجنسية" : "Nationality", value: profile.nationality as string | null },
    { label: isAr ? "الجنس" : "Gender", value: profile.gender as string | null },
    { label: isAr ? "انتهاء الجواز" : "Passport expiry", value: profile.passport_expiry as string | null },
    { label: isAr ? "لون العيون" : "Eye color", value: profile.eye_color as string | null },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground break-words">{r.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}
