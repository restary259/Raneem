import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePipelineStatuses } from "@/hooks/usePipelineStatuses";
import { statusColorClasses } from "@/lib/caseStatus";
import { whatsappUrl, normalizePhone, isLinkablePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CalendarPlus, Loader2, MessageCircle, Phone, Send, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { advanceCaseStage } from "@/services/CaseStageService";
import { submitCaseForReview, sendInvoiceEmail } from "@/services/CaseInvoiceService";
import CaseProgressRail from "@/components/cases/CaseProgressRail";
import CaseAttentionPanel from "@/components/cases/CaseAttentionPanel";
import { deriveCaseTasks, type CaseTask } from "@/components/cases/caseTasks";
import CaseOverviewPanel from "@/components/cases/CaseOverviewPanel";
import CaseStageBlock, { type AppointmentRow } from "@/components/cases/CaseStageBlock";
import CaseProfilePanel from "@/components/cases/CaseProfilePanel";
import CaseFinance, { type CaseFinanceHandle, type CaseFinanceReadiness } from "@/components/cases/CaseFinance";
import CaseProgramTab from "@/components/cases/CaseProgramTab";
import CaseProfileSummary from "@/components/cases/CaseProfileSummary";
import {
  missingProfileFields,
  PROFILE_FIELD_LABEL_KEYS,
  readStudentProfile,
  type StudentProfileValues,
} from "@/lib/studentProfileFields";
import { readFunctionErrorBody } from "@/lib/functionError";
import { identityConflictMessage } from "@/lib/identityConflict";
import { submitBlockedMessage } from "@/lib/submitError";
import AppointmentSchedulerModal from "@/components/team/AppointmentSchedulerModal";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CaseRow {
  id: string;
  case_reference: string | null;
  full_name: string;
  phone_number: string;
  status: string;
  assigned_to: string | null;
  student_user_id: string | null;
  last_activity_at: string;
  created_at: string;
  [key: string]: unknown;
}

/** Stages where scheduling another appointment still makes sense. */
const SCHEDULE_STAGES = ["contacted", "appointment_scheduled"];

/** Active view inside the tabbed profile-completion layout. */
type WorkflowView = "overview" | "profile" | "finance";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const { statuses } = usePipelineStatuses();
  const isRtl = i18n.dir() === "rtl";
  const isMobile = useIsMobile();

  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [documents, setDocuments] = useState<{ category: string }[]>([]);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [forgottenDays, setForgottenDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  /** Tabbed layout (profile_completion / payment_confirmed) active view. */
  const [activeView, setActiveView] = useState<WorkflowView>("overview");
  /** Latest readiness snapshot pushed up by the Finance tab. */
  const [financeReadiness, setFinanceReadiness] = useState<CaseFinanceReadiness | null>(null);
  const financeApiRef = useRef<CaseFinanceHandle>(null);

  /** Scrolls the Finance section into view (the single place to confirm the
      DARB payment now that the duplicate confirmation modal is gone). */
  const financeRef = useRef<HTMLDivElement>(null);
  const focusFinance = () => {
    const el = financeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-primary/40");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 1800);
  };

  /** Switch to the Finance tab and bring it into view (tabbed layout). */
  const gotoFinance = () => {
    setActiveView("finance");
    window.setTimeout(focusFinance, 80);
  };

  /** Stable so CaseFinance's readiness effect never re-fires on re-renders. */
  const handleReadinessChange = useCallback((readiness: CaseFinanceReadiness) => {
    setFinanceReadiness((prev) => {
      if (
        prev &&
        prev.servicesSelected === readiness.servicesSelected &&
        prev.serviceTotal === readiness.serviceTotal &&
        prev.agencyConfirmed === readiness.agencyConfirmed &&
        prev.agencyAck === readiness.agencyAck &&
        prev.confirming === readiness.confirming
      ) {
        return prev;
      }
      return readiness;
    });
  }, []);

  /** Default to the view where the actual work happens for each stage. */
  useEffect(() => {
    if (caseData?.status === "profile_completion") setActiveView("profile");
    else if (caseData?.status === "payment_confirmed") setActiveView("finance");
  }, [caseData?.status]);

  const canManage = role === "admin" || role === "team_member";

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes, docsRes, settingsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase.from("appointments").select("*").eq("case_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("case_submissions").select("*").eq("case_id", id).maybeSingle(),
        supabase.from("documents").select("category").eq("case_id", id),
        supabase.from("platform_settings").select("forgotten_contacted_days").maybeSingle(),
      ]);

      if (caseRes.error) throw caseRes.error;
      const row = caseRes.data as unknown as CaseRow;
      setCaseData(row);
      setAppointments((apptRes.data as AppointmentRow[]) ?? []);
      setSubmission(subRes.data ?? null);
      setDocuments((docsRes.data as { category: string }[]) ?? []);
      if (settingsRes.data?.forgotten_contacted_days) {
        setForgottenDays(settingsRes.data.forgotten_contacted_days);
      }

      if (row.assigned_to) {
        if (row.assigned_to === user?.id) {
          // The staff directory intentionally hides peers from team members,
          // so resolve our own name directly.
          const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          setAssigneeName(me?.full_name ?? null);
        } else {
          const { data: staff } = await supabase.rpc("get_staff_directory");
          const match = (staff as { id: string; full_name: string }[] | null)?.find((s) => s.id === row.assigned_to);
          setAssigneeName(match?.full_name ?? null);
        }
      } else {
        setAssigneeName(null);
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast, isRtl, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const tasks = useMemo(() => {
    if (!caseData) return [];
    return deriveCaseTasks({
      status: caseData.status,
      lastActivityAt: caseData.last_activity_at,
      submission,
      documents,
      appointments,
      forgottenDays,
    });
  }, [caseData, submission, documents, appointments, forgottenDays]);

  const handleTask = (task: CaseTask) => {
    switch (task.action) {
      case "schedule_appointment":
        setSchedulerOpen(true);
        break;
      case "record_outcome":
        if (task.appointmentId) setOutcomeApptId(task.appointmentId);
        break;
      default:
        break;
    }
  };

  const handleAdvance = async () => {
    if (!caseData || !pendingStage) return;
    setAdvancing(true);
    try {
      await advanceCaseStage(caseData.id, caseData.status, pendingStage);
      toast({ description: t("case.stage.moved") });
      setPendingStage(null);
      await fetchData();
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
    } finally {
      setAdvancing(false);
    }
  };

  const canSubmitToAdmin = canManage && caseData?.status === "payment_confirmed";

  // Student contact details surfaced inside the Finance tab's invite block.
  const studentInvite = useMemo(() => {
    if (!caseData || !submission) {
      return { email: "", fullName: "", phone: "" as string | null };
    }
    const values = readStudentProfile(caseData as any, submission);
    return {
      email: (values.student_email || "").trim(),
      fullName: caseData.full_name,
      phone: values.student_phone ?? null,
    };
  }, [caseData, submission]);

  const handleSubmitToAdmin = async () => {
    if (!caseData || !submission || !user) return;
    setSubmitting(true);
    try {
      // One backend call: it re-checks the gate, flips the case to `submitted`
      // and issues the invoice from the authoritative server-side financials.
      const invoice = await submitCaseForReview(caseData.id);
      toast({ description: t("case.submit.success") });
      const emailed = await sendInvoiceEmail(invoice);
      toast({
        description: emailed
          ? t("case.invoice.emailSent", { number: invoice.invoice_number })
          : t("case.invoice.emailFailed", { number: invoice.invoice_number }),
        variant: emailed ? undefined : "destructive",
      });

      // Second mail: the student's dashboard activation link. Sent to the same
      // address as the invoice; the backend skips duplicate invites itself.
      const profileValues = readStudentProfile(caseData as any, submission);
      const studentEmail = (invoice.student_email || profileValues.student_email || "").trim();
      if (studentEmail) {
        const { error: inviteError } = await supabase.functions.invoke("create-student-from-case", {
          body: {
            case_id: caseData.id,
            student_email: studentEmail,
            student_full_name: caseData.full_name,
            student_phone: profileValues.student_phone ?? null,
          },
        });
        if (inviteError) {
          const body = await readFunctionErrorBody(inviteError);
          const conflict = identityConflictMessage(body as any, t);
          toast({
            variant: "destructive",
            description: conflict ?? t("case.invite.failed", "Could not send the student dashboard invitation."),
          });
        } else {
          toast({ description: t("case.invite.sent", { email: studentEmail }) });
        }
      }

      await fetchData();
    } catch (error) {
      const blocked = submitBlockedMessage(error, t);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: blocked ?? t("common.actionFailed"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Admin sent the file back for a change: the case sits in profile_completion
   * again, so put it back through payment_confirmed before resubmitting.
   */
  const handleResubmit = async () => {
    if (!caseData || !submission) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("resubmit_case_for_review", {
        p_case_id: caseData.id,
      });
      if (error) throw error;
      toast({ description: t("case.submit.success") });
      await fetchData();
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
    } finally {
      setSubmitting(false);
    }
  };

  /** Top-bar "Confirm & Save": drives the Finance tab's single action, then
      refetches so the case status flips to payment_confirmed. */
  const handleConfirmAndSave = async () => {
    try {
      await financeApiRef.current?.confirmAndSave();
    } finally {
      await fetchData();
    }
  };

  /** Profile completeness used to drive the top action button.
      Declared before the early returns so the hook order never changes. */
  const profileValues = useMemo(
    () => (caseData && submission ? readStudentProfile(caseData, submission) : null),
    [caseData, submission],
  );

  // Only the first load blanks the page. Later refetches keep the tree mounted so
  // an in-progress student profile draft is never wiped by a background refresh.
  if (loading && !caseData) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">{t("case.detail.loading")}</div>
    );
  }

  if (!caseData) {
    return <div className="p-6 text-muted-foreground">{t("case.detail.notFound")}</div>;
  }

  const statusMeta = statuses.find((s) => s.key === caseData.status);
  const Back = isRtl ? ArrowRight : ArrowLeft;
  const showTerminalTabs = caseData.status === "submitted" || caseData.status === "enrollment_paid";
  const showTabbedWorkflow = caseData.status === "profile_completion" || caseData.status === "payment_confirmed";

  const missingFields = profileValues ? missingProfileFields(profileValues) : [];

  const fieldName = (f: keyof StudentProfileValues) => t(PROFILE_FIELD_LABEL_KEYS[f]);
  const savedComplete = !!submission?.profile_completed_at && missingFields.length === 0;
  const reopenedResend = submission?.review_status === "changes_requested" && !!submission?.payment_confirmed;

  /** Finance is ready to confirm once services are chosen and (if still unpaid)
      the receipt checkbox has been ticked in the Finance tab. */
  const financeReadyToConfirm =
    !!financeReadiness &&
    financeReadiness.servicesSelected &&
    financeReadiness.serviceTotal > 0 &&
    (financeReadiness.agencyConfirmed || financeReadiness.agencyAck);
  const waHref = whatsappUrl(caseData.phone_number);
  const phoneUsable = isLinkablePhone(caseData.phone_number);
  const contactHref = isMobile ? `tel:+${normalizePhone(caseData.phone_number)}` : (waHref ?? "#");
  const ContactIcon = isMobile ? Phone : MessageCircle;

  /**
   * The dashboard often runs inside a preview iframe where a plain
   * `target="_blank"` anchor is silently swallowed by the sandbox. Open the
   * link programmatically and, when the popup is blocked, fall back to the
   * current tab so the button always does something visible.
   */
  const handleContactClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!phoneUsable) {
      e.preventDefault();
      toast({
        variant: "destructive",
        description: t("case.header.noPhone", "No valid phone number on this case"),
      });
      return;
    }
    if (isMobile) return; // tel: links work natively
    e.preventDefault();
    const opened = window.open(contactHref, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = contactHref;
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:p-6">
      {/* Persistent header */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(-1)}
              aria-label={t("common.back")}
            >
              <Back className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-medium">{caseData.full_name}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {caseData.case_reference ?? `#${caseData.id.slice(0, 8)}`}
                {" · "}
                {assigneeName ? t("case.header.assignedTo", { name: assigneeName }) : t("case.header.unassigned")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a
                href={contactHref}
                onClick={handleContactClick}
                aria-disabled={!phoneUsable}
                target={isMobile ? undefined : "_blank"}
                rel={isMobile ? undefined : "noreferrer"}
              >
                <ContactIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isMobile ? t("case.header.call") : t("case.header.whatsapp")}</span>
              </a>
            </Button>

            {canManage && SCHEDULE_STAGES.includes(caseData.status) && (
              <Button size="sm" className="gap-1.5" onClick={() => setSchedulerOpen(true)}>
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("case.header.schedule")}</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`shrink-0 whitespace-nowrap border ${statusColorClasses(statusMeta?.color)}`}
          >
            {t(`case.status.${caseData.status}`, statusMeta?.label_en ?? caseData.status)}
          </Badge>
          <CaseProgressRail statuses={statuses} currentKey={caseData.status} />
        </div>
      </div>

      {canManage && submission?.review_status === "changes_requested" && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-700">{t("case.submit.changesRequested")}</p>
          {submission.review_note && <p className="mt-1 text-sm text-muted-foreground">{submission.review_note}</p>}
        </div>
      )}

      {canManage && <CaseAttentionPanel tasks={tasks} onAction={handleTask} />}

      {showTerminalTabs ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="overview">{t("case.terminal.overview")}</TabsTrigger>
            <TabsTrigger value="profile">{t("case.terminal.profile")}</TabsTrigger>
            <TabsTrigger value="finance">{t("case.terminal.finance")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-3">
            <div className="rounded-md border bg-card p-4 sm:p-5">
              <h2 className="text-sm font-semibold">
                {caseData.status === "submitted" ? t("case.detail.submittedToAdmin") : t("case.detail.studentEnrolled")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {caseData.status === "submitted" ? t("case.detail.waitingAdminReview") : t("case.detail.caseComplete")}
              </p>
            </div>
            <CaseOverviewPanel caseData={caseData} />
            <section className="rounded-md border bg-card">
              <CaseProgramTab submission={submission} onRefresh={fetchData} />
            </section>
          </TabsContent>
          <TabsContent value="profile">
            <CaseProfileSummary caseData={caseData} submission={submission} />
          </TabsContent>
          <TabsContent value="finance">
            <div ref={financeRef} className="rounded-xl transition-shadow">
              <CaseFinance
                caseId={caseData.id}
                canManage={role === "admin" || role === "team_member"}
                canConfirm={role === "admin"}
                showGermany
                caseStatus={caseData.status}
                studentEmail={studentInvite.email}
                studentFullName={studentInvite.fullName}
                studentPhone={studentInvite.phone}
                studentUserId={caseData.student_user_id ?? null}
                onSubmitToAdmin={canSubmitToAdmin ? handleSubmitToAdmin : undefined}
                submitting={submitting}
              />
            </div>
          </TabsContent>
        </Tabs>
      ) : showTabbedWorkflow ? (
        <>
          {/* Sticky action bar: view switcher + the single context-aware action. */}
          <div className="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="hidden sm:block">
                <Tabs value={activeView} onValueChange={(v) => setActiveView(v as WorkflowView)}>
                  <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="overview">{t("case.switcher.overview")}</TabsTrigger>
                    <TabsTrigger value="profile">{t("case.switcher.profile")}</TabsTrigger>
                    <TabsTrigger value="finance">{t("case.switcher.finance")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Select value={activeView} onValueChange={(v) => setActiveView(v as WorkflowView)}>
                <SelectTrigger className="sm:hidden flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">{t("case.switcher.overview")}</SelectItem>
                  <SelectItem value="profile">{t("case.switcher.profile")}</SelectItem>
                  <SelectItem value="finance">{t("case.switcher.finance")}</SelectItem>
                </SelectContent>
              </Select>

              <div className="hidden flex-1 sm:block" />

              {canManage &&
                (() => {
                  if (caseData.status === "profile_completion" && reopenedResend) {
                    return (
                      <Button className="gap-1.5" disabled={submitting} onClick={() => void handleResubmit()}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {t("case.submit.resend")}
                      </Button>
                    );
                  }
                  if (!savedComplete) {
                    return (
                      <Button className="gap-1.5" onClick={() => setActiveView("profile")}>
                        {t("case.action.completeProfile", { defaultValue: "Complete student profile" })}
                      </Button>
                    );
                  }
                  if (caseData.status === "payment_confirmed") {
                    return (
                      <Button className="gap-1.5" disabled={submitting} onClick={() => void handleSubmitToAdmin()}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {t("finance.invite.action")}
                      </Button>
                    );
                  }
                  return (
                    <Button
                      className="gap-1.5"
                      disabled={financeReadiness?.confirming}
                      onClick={() => {
                        if (financeReadyToConfirm) void handleConfirmAndSave();
                        else gotoFinance();
                      }}
                    >
                      {financeReadiness?.confirming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      {t("finance.confirmAndSave.action")}
                    </Button>
                  );
                })()}
            </div>

            {canManage &&
              (() => {
                if (caseData.status === "profile_completion" && reopenedResend) {
                  return t("case.actionHint.resend", {
                    defaultValue: "Save the requested change, then send the file back to admin.",
                  });
                }
                if (!savedComplete) {
                  return missingFields.length > 0
                    ? `${t("case.actionHint.missingProfile", {
                        defaultValue: "Complete the missing profile fields to continue:",
                      })} ${missingFields.map(fieldName).join(" · ")}`
                    : t("case.actionHint.missingProfile", {
                        defaultValue: "Complete the missing profile fields to continue.",
                      });
                }
                if (caseData.status === "profile_completion") {
                  return financeReadyToConfirm
                    ? t("case.actionHint.confirmReady", {
                        defaultValue: "Confirms the DARB service payment and moves the case to payment confirmed.",
                      })
                    : t("case.actionHint.financeNotReady", {
                        defaultValue:
                          "Open Finance, select the DARB services and tick the receipt confirmation, then Confirm & Save.",
                      });
                }
                return t("case.actionHint.submitReady", {
                  defaultValue: "Submits to Admin: issues the DARB invoice and sends the student dashboard invite.",
                });
              })()}
          </div>

          {/* Panels stay mounted (hidden via CSS) so in-progress state — a draft
              profile or a ticked receipt checkbox — survives tab switching. */}
          <div className={cn("space-y-3", activeView !== "overview" && "hidden")}>
            <CaseOverviewPanel caseData={caseData} />
          </div>

          <div className={cn("space-y-3", activeView !== "profile" && "hidden")}>
            <CaseProfilePanel
              status={caseData.status}
              caseData={caseData}
              submission={submission}
              canManage={canManage}
              onRefresh={fetchData}
            />
          </div>

          <div className={cn("space-y-3", activeView !== "finance" && "hidden")}>
            <div ref={financeRef} className="rounded-xl transition-shadow">
              <CaseFinance
                ref={financeApiRef}
                caseId={caseData.id}
                canManage={role === "admin" || role === "team_member"}
                canConfirm={role === "admin"}
                showGermany={
                  role === "admin" || caseData.status === "submitted" || caseData.status === "enrollment_paid"
                }
                caseStatus={caseData.status}
                studentEmail={studentInvite.email}
                studentFullName={studentInvite.fullName}
                studentPhone={studentInvite.phone}
                studentUserId={caseData.student_user_id ?? null}
                onSubmitToAdmin={canSubmitToAdmin ? handleSubmitToAdmin : undefined}
                submitting={submitting}
                delegateActionsToTopBar
                onReadinessChange={handleReadinessChange}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <CaseOverviewPanel caseData={caseData} />
          <CaseStageBlock
            caseData={caseData}
            submission={submission}
            appointments={appointments}
            canManage={canManage}
            onSchedule={() => setSchedulerOpen(true)}
            onRecordOutcome={(apptId) => setOutcomeApptId(apptId)}
            onAdvance={(to) => setPendingStage(to)}
            onConfirmPayment={gotoFinance}
            onRefresh={fetchData}
            onSubmitToAdmin={handleSubmitToAdmin}
            onResubmit={handleResubmit}
            submitting={submitting}
          />
        </>
      )}

      {/* Modals */}
      {canManage && user && (
        <AppointmentSchedulerModal
          open={schedulerOpen}
          onClose={() => setSchedulerOpen(false)}
          caseId={caseData.id}
          teamMemberId={caseData.assigned_to ?? user.id}
          actorName={user.email ?? ""}
          guestName={caseData.full_name}
          caseStatus={caseData.status}
          onSuccess={() => {
            setSchedulerOpen(false);
            void fetchData();
          }}
        />
      )}

      {canManage && outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={() => {
            setOutcomeApptId(null);
            void fetchData();
          }}
        />
      )}

      {/*
        The DARB payment is confirmed from the top action bar's single
        "Confirm & Save" button, which drives the Finance tab's one action.
        The attention-panel / stage-block "confirm payment" buttons switch to
        the Finance tab instead.
      */}

      <Dialog open={!!pendingStage} onOpenChange={(open) => !open && setPendingStage(null)}>
        <DialogContent>
          {(() => {
            const stageLabel = (key: string) =>
              t(`case.status.${key}`, statuses.find((s) => s.key === key)?.label_en ?? key);
            const target = pendingStage ? stageLabel(pendingStage) : "";
            return (
              <DialogHeader>
                <DialogTitle>{t("case.stage.confirmTitle", { stage: target })}</DialogTitle>
                <DialogDescription>
                  {t("case.stage.confirmBody", { from: stageLabel(caseData.status), to: target })}
                </DialogDescription>
              </DialogHeader>
            );
          })()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingStage(null)} disabled={advancing}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAdvance} disabled={advancing}>
              {advancing ? t("case.stage.confirmPending") : t("case.stage.confirmAction")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
