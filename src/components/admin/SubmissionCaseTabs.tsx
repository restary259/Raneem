import { useTranslation } from "react-i18next";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/common/CopyButton";
import { toneClasses } from "@/lib/statusTokens";
import CaseFinance, {
  type CaseFinanceReadiness,
} from "@/components/cases/CaseFinance";
import CaseInvoiceBlock from "@/components/admin/CaseInvoiceBlock";
import DirectRegistrationFinance from "@/components/cases/DirectRegistrationFinance";
import { useEffect } from "react";

/**
 * A submission as the Admin Submissions page fetches it. Declared here (and
 * re-imported by the page) so the tabbed body and its consumer share one
 * definition rather than drifting apart.
 */
export interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  created_at: string;
  education_level: string | null;
  city: string | null;
  passport_type: string | null;
  student_user_id: string | null;
  partner_id: string | null;
  referred_by: string | null;
  assigned_to: string | null;
  submission?: {
    id: string;
    service_fee: number;
    submitted_at: string | null;
    enrollment_paid_at: string | null;
    program_id: string | null;
    accommodation_id: string | null;
    program_start_date: string | null;
    program_end_date: string | null;
    payment_confirmed: boolean;
    program_price: number | null;
    program_weeks: number | null;
    program_weekly_price: number | null;
    accommodation_price: number | null;
    accommodation_weeks: number | null;
    accommodation_weekly_price: number | null;
    extra_data: Record<string, unknown> | null;
  } | null;
  registrationInvoice?: any | null;
  documents?: Array<{
    id: string;
    file_name: string;
    file_url: string;
    category: string;
    created_at: string;
  }>;
}

interface SubmissionCaseTabsProps {
  caseData: SubmittedCase;
  programNames: Record<string, string>;
  accommodationNames: Record<string, string>;
  /** Resolved payment method for this case, when the page has looked it up. */
  paymentMethod?: string;
  /** Pre-formatted DARB service total (the page owns the ILS formatting). */
  serviceTotalLabel: string;
  fmt: (ts: string | null) => string;
  onOpenDocument: (fileUrl: string) => void;
  onFinanceReadinessChange: (readiness: CaseFinanceReadiness) => void;
}

/**
 * Read-only, tabbed body of a submission case card.
 *
 * Every panel is `forceMount`ed and hidden with CSS rather than unmounted. That
 * is load-bearing, not cosmetic: `CaseFinance` reports its Germany-payment
 * readiness through `onReadinessChange`, and the page uses that snapshot to
 * enable "Mark as Enrolled". An unmounted Finance panel would never report, so
 * enrollment would stay permanently disabled until the admin happened to open
 * the Finance tab. Same pattern as the nested tabs in `CaseFinance.tsx`.
 */
export default function SubmissionCaseTabs({
  caseData,
  programNames,
  accommodationNames,
  paymentMethod,
  serviceTotalLabel,
  fmt,
  onOpenDocument,
  onFinanceReadinessChange,
}: SubmissionCaseTabsProps) {
  const { t } = useTranslation("dashboard");

  useEffect(() => {
    if (caseData.source === "student_referral_registration") {
      const paid = caseData.registrationInvoice?.payment_status === "paid";
      onFinanceReadinessChange({
        servicesSelected: true,
        serviceTotal: Number(caseData.registrationInvoice?.total_amount ?? 0),
        agencyConfirmed: paid,
        agencyAck: paid,
        confirming: false,
        germanyRequiredTotal: 0,
        germanyConfirmedRequired: 0,
      });
    }
  }, [caseData.source, caseData.registrationInvoice?.payment_status, caseData.registrationInvoice?.total_amount, onFinanceReadinessChange]);

  // Trigger and content are derived from the SAME boolean so a tab can never
  // appear without content (or vice versa).
  const showProgram = Boolean(
    caseData.submission?.program_id || caseData.submission?.accommodation_id,
  );
  const showDocuments = (caseData.documents?.length ?? 0) > 0;

  const extraData = caseData.submission?.extra_data;
  const showProfileData = Boolean(
    extraData && Object.keys(extraData).length > 0,
  );

  return (
    <Tabs defaultValue="overview" className="w-full min-w-0 max-w-full">
      {/* Six triggers do not fit a phone width as a grid — scroll instead. */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 scrollbar-thin">
        <TabsList className="w-max min-w-full justify-start gap-1 flex-nowrap">
          <TabsTrigger value="overview">
            {t("admin.submissions.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="profile">
            {t("admin.submissions.tabs.profile")}
          </TabsTrigger>
          {showProgram && (
            <TabsTrigger value="program">
              {t("admin.submissions.tabs.program")}
            </TabsTrigger>
          )}
          <TabsTrigger value="finance">
            {t("admin.submissions.tabs.finance")}
          </TabsTrigger>
          <TabsTrigger value="invoice">
            {t("admin.submissions.tabs.invoice")}
          </TabsTrigger>
          {showDocuments && (
            <TabsTrigger value="documents">
              {t("admin.submissions.tabs.documents")}
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* ── Overview: basic info + payment details ── */}
      <TabsContent
        value="overview"
        className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
        forceMount
      >
        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("admin.submissions.basicInfo")}
          </h3>
          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {t("admin.submissions.phone")}:
              </span>
              <div className="flex min-w-0 items-start gap-1">
                <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">{caseData.phone_number}</p>
                <CopyButton value={caseData.phone_number} />
              </div>
            </div>
            {(() => {
              const extra = (caseData.submission?.extra_data ?? {}) as Record<string, unknown>;
              const na = t("admin.submissions.notCollected");
              const cityVal = caseData.city || (extra.city as string) || "";
              const eduVal = caseData.education_level || (extra.education_level as string) || "";
              const passVal = (
                caseData.passport_type || (extra.passport_type as string) || ""
              ).replace(/_/g, " ");
              return (
                <>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">
                      {t("admin.submissions.city")}:
                    </span>
                    <div className="flex min-w-0 items-start gap-1">
                      <p className={`min-w-0 break-words [overflow-wrap:anywhere] ${cityVal ? "font-medium" : "text-muted-foreground italic"}`}>
                        {cityVal || na}
                      </p>
                      {cityVal && <CopyButton value={cityVal} />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">
                      {t("admin.submissions.education")}:
                    </span>
                    <div className="flex min-w-0 items-start gap-1">
                      <p className={`min-w-0 break-words [overflow-wrap:anywhere] ${eduVal ? "font-medium" : "text-muted-foreground italic"}`}>
                        {eduVal || na}
                      </p>
                      {eduVal && <CopyButton value={eduVal} />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground">
                      {t("admin.submissions.passport")}:
                    </span>
                    <div className="flex min-w-0 items-start gap-1">
                      <p className={`min-w-0 break-words [overflow-wrap:anywhere] ${passVal ? "font-medium" : "text-muted-foreground italic"}`}>
                        {passVal || na}
                      </p>
                      {passVal && <CopyButton value={passVal} />}
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {t("admin.submissions.submittedDate")}:
              </span>
              <div className="flex min-w-0 items-start gap-1">
                <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                  {fmt(caseData.submission?.submitted_at || null)}
                </p>
                {caseData.submission?.submitted_at && (
                  <CopyButton value={fmt(caseData.submission.submitted_at)} />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {t("admin.submissions.payment")}:
              </span>
              <Badge className={caseData.submission?.payment_confirmed ? "bg-primary/10 text-primary" : toneClasses("payment").chip}>
                {caseData.submission?.payment_confirmed
                  ? t("admin.submissions.paymentConfirmed")
                  : t("admin.submissions.paymentPending")}
              </Badge>
            </div>
            {paymentMethod && (
              <div className="min-w-0">
                <span className="text-muted-foreground">
                  {t("finance.paymentMethod.label", "Payment method")}:
                </span>
                <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                  {t(`finance.paymentMethod.${paymentMethod}`, paymentMethod === "cash" ? "Cash" : "Bank Transfer")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("admin.submissions.paymentDetails")}
          </h3>
          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {caseData.submission?.program_start_date && (
              <div className="min-w-0">
                <span className="text-muted-foreground">
                  {t("admin.submissions.startDate")}:
                </span>
                <div className="flex min-w-0 items-start gap-1">
                  <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                    {fmt(caseData.submission.program_start_date)}
                  </p>
                  <CopyButton value={fmt(caseData.submission.program_start_date)} />
                </div>
              </div>
            )}
            {caseData.submission?.program_end_date && (
              <div className="min-w-0">
                <span className="text-muted-foreground">
                  {t("admin.submissions.endDate")}:
                </span>
                <div className="flex min-w-0 items-start gap-1">
                  <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                    {fmt(caseData.submission.program_end_date)}
                  </p>
                  <CopyButton value={fmt(caseData.submission.program_end_date)} />
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 min-w-0 max-w-full p-3 rounded-lg bg-muted text-sm break-words [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">{t("admin.submissions.total")}:</span>
            <span className="font-bold ms-2 text-foreground">{serviceTotalLabel} ILS</span>
          </div>
        </div>
      </TabsContent>

      {/* ── Profile: the submission's extra_data key/value grid ── */}
      <TabsContent
        value="profile"
        className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
        forceMount
      >
        <div className="min-w-0 max-w-full">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("admin.submissions.studentProfileData")}
          </h3>
          {showProfileData ? (
            <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {Object.entries(extraData ?? {}).map(([key, val]) => {
                if (!val || val === "") return null;
                if (key === "program_id" || key === "accommodation_id") return null;
                const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <div key={key} className="min-w-0">
                    <span className="text-muted-foreground break-words [overflow-wrap:anywhere]">{fieldLabel}:</span>
                    <div className="flex min-w-0 items-start gap-1">
                      <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">{String(val)}</p>
                      <CopyButton value={String(val)} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("admin.submissions.notCollected")}</p>
          )}
        </div>
      </TabsContent>

      {/* ── Program: resolved names + EUR prices ── */}
      {showProgram && (
        <TabsContent
          value="program"
          className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
          forceMount
        >
          <div className="min-w-0 max-w-full">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {t("admin.submissions.programAccom")}
            </h3>
            <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {caseData.submission?.program_id && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">{t("admin.submissions.program")}:</span>
                  <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                    {programNames[caseData.submission.program_id] || caseData.submission.program_id}
                  </p>
                  {caseData.submission?.program_price ? (
                    <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                      {caseData.submission?.program_weeks && caseData.submission?.program_weekly_price
                        ? `${caseData.submission.program_weeks} × €${Number(caseData.submission.program_weekly_price).toLocaleString("en-US")} = `
                        : ""}
                      €{Number(caseData.submission.program_price).toLocaleString("en-US")}
                    </p>
                  ) : null}
                </div>
              )}
              {caseData.submission?.accommodation_id && (
                <div className="min-w-0">
                  <span className="text-muted-foreground">{t("admin.submissions.accommodation")}:</span>
                  <p className="min-w-0 break-words [overflow-wrap:anywhere] font-medium">
                    {accommodationNames?.[caseData.submission.accommodation_id] || caseData.submission.accommodation_id}
                  </p>
                  {caseData.submission?.accommodation_price ? (
                    <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                      {caseData.submission?.accommodation_weeks && caseData.submission?.accommodation_weekly_price
                        ? `${caseData.submission.accommodation_weeks} × €${Number(caseData.submission.accommodation_weekly_price).toLocaleString("en-US")} = `
                        : ""}
                      €{Number(caseData.submission.accommodation_price).toLocaleString("en-US")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      )}

      {/* ── Finance: keeps its own Summary/Invoice sub-tabs ── */}
      <TabsContent
        value="finance"
        className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
        forceMount
      >
        <div className="min-w-0 max-w-full">
          {caseData.source === "student_referral_registration" ? (
            <DirectRegistrationFinance invoice={caseData.registrationInvoice} caseStatus={caseData.status} />
          ) : (
            <CaseFinance
              caseId={caseData.id}
              canManage={false}
              canConfirm={true}
              onReadinessChange={onFinanceReadinessChange}
            />
          )}
        </div>
      </TabsContent>

      {/* ── Invoice ── */}
      <TabsContent
        value="invoice"
        className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
        forceMount
      >
        <div className="min-w-0 max-w-full">
          <CaseInvoiceBlock caseId={caseData.id} caseStatus={caseData.status} />
        </div>
      </TabsContent>

      {/* ── Documents ── */}
      {showDocuments && (
        <TabsContent
          value="documents"
          className="min-w-0 w-full max-w-full overflow-x-hidden space-y-5 data-[state=inactive]:hidden"
          forceMount
        >
          <div className="min-w-0 max-w-full">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" /> {t("admin.submissions.documents")} ({caseData.documents?.length ?? 0})
            </h3>
            <div className="min-w-0 max-w-full divide-y divide-border rounded-lg border border-border overflow-hidden">
              {caseData.documents?.map((doc) => (
                <div key={doc.id} className="flex min-w-0 items-center justify-between p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="min-w-0 text-sm font-medium break-words [overflow-wrap:anywhere]">{doc.file_name}</p>
                    <p className="min-w-0 text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">{doc.category} · {fmt(doc.created_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1"
                    onClick={() => onOpenDocument(doc.file_url)}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
