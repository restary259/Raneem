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
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePipelineStatuses } from "@/hooks/usePipelineStatuses";
import { useCaseFinancials, type CaseFinancials } from "@/hooks/useCaseFinancials";
import { useCaseEvents } from "@/hooks/useCaseEvents";
import { statusColorClasses } from "@/lib/caseStatus";
import { whatsappUrl, normalizePhone, isLinkablePhone } from "@/lib/phone";
import { formatILS } from "@/lib/money";
import { readStudentProfile, missingProfileFields } from "@/lib/studentProfileFields";
import CaseProgressRail from "@/components/cases/CaseProgressRail";
import CaseProfileSummary from "@/components/cases/CaseProfileSummary";
import CaseTimeline from "@/components/cases/CaseTimeline";

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
 * (CaseProgressRail, CaseProfileSummary, CaseTimeline) and reads money from
 * the authoritative `get_case_financials` RPC via useCaseFinancials — the
 * frontend never re-adds prices, so displayed totals always match the case
 * Finance tab.
 *
 * Graceful degradation: when `caseData` is null (standalone student with no
 * linked case) the progress rail / next-action / financial snapshot /
 * recent-activity sections are hidden and only Contact + Visa (+ Documents)
 * remain.
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
  const { events, loading: eventsLoading } = useCaseEvents(hasCase ? caseId : undefined);

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
  const nextAction: NextAction | null = (() => {
    if (!hasCase) return null;
    const status = statusKey;
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
    if (status === "submitted" || status === "enrollment_paid") {
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
      {/* ── Header ───────────────────────────────────────────────────── */}
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
                {caseRef && <span className="font-medium text-foreground">#{caseRef}</span>}
                {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
                {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
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

      {/* ── Student information tabs ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t("studentOverview.studentInformation", "Student information")}
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

      {/* ── Recent activity ─────────────────────────────────────────── */}
      {hasCase && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {t("studentOverview.recentActivity", "Recent activity")}
            </CardTitle>
            {openCase && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate(openCase)}>
                {t("studentOverview.viewAll", "View all")}
                <Chevron className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {eventsLoading ? (
              <div className="py-4 flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("caseTimeline.empty", "No activity yet.")}</p>
            ) : (
              <CaseTimeline caseId={caseId!} canAddNote={false} />
            )}
          </CardContent>
        </Card>
      )}
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
  t: (key: string, fallback?: string) => string;
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
      {hasDiscount && row(`− ${t("studentOverview.referralDiscount", "Referral discount")}`, formatILS(fin.referral_discount))}
      {row(t("finance.summary.services", "Services"), formatILS(fin.service_total), true)}
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
}: {
  fields: VisaField[];
  values: Record<string, string>;
  loading: boolean;
  isAr: boolean;
  t: (key: string, fallback?: string) => string;
}) {
  if (loading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (fields.length === 0 || fields.every((f) => !values[f.id])) {
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
    { label: isAr ? "الجامعة" : "University", value: profile.university_name as string | null },
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
