import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, ArrowRight, CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { advanceCaseStage } from "@/services/CaseStageService";
import { submitCaseForReview, sendInvoiceEmail } from "@/services/CaseInvoiceService";
import CaseProgressRail from "@/components/cases/CaseProgressRail";
import CaseAttentionPanel from "@/components/cases/CaseAttentionPanel";
import { deriveCaseTasks, type CaseTask } from "@/components/cases/caseTasks";
import CaseOverviewPanel from "@/components/cases/CaseOverviewPanel";
import CaseStageBlock, { type AppointmentRow } from "@/components/cases/CaseStageBlock";
import CaseFinance from "@/components/cases/CaseFinance";
import CaseProgramTab from "@/components/cases/CaseProgramTab";
import CaseProfileSummary from "@/components/cases/CaseProfileSummary";
import { readStudentProfile } from "@/lib/studentProfileFields";
import AppointmentSchedulerModal from "@/components/team/AppointmentSchedulerModal";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import PaymentConfirmationForm from "@/components/team/PaymentConfirmationForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/** Stages where the money side of the case is relevant. */
const FINANCE_STAGES = ["profile_completion", "payment_confirmed", "submitted", "enrollment_paid"];

/** Stages where scheduling another appointment still makes sense. */
const SCHEDULE_STAGES = ["contacted", "appointment_scheduled"];

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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

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
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
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
      case "confirm_payment":
        setPaymentOpen(true);
        break;
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
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAdvancing(false);
    }
  };

  const canSubmitToAdmin = canManage && caseData?.status === "payment_confirmed";

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
          toast({
            variant: "destructive",
            description: t("case.invite.failed", "Could not send the student dashboard invitation."),
          });
        } else {
          toast({ description: t("case.invite.sent", { email: studentEmail }) });
        }
      }

      await fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
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
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

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
  const showFinance = FINANCE_STAGES.includes(caseData.status);
  const showTerminalTabs = caseData.status === "submitted" || caseData.status === "enrollment_paid";
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
            <CaseFinance
              caseId={caseData.id}
              canManage={role === "admin" || role === "team_member"}
              canConfirm={role === "admin"}
              showGermany
            />
          </TabsContent>

        </Tabs>
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
            onConfirmPayment={() => setPaymentOpen(true)}
            onRefresh={fetchData}
            onSubmitToAdmin={handleSubmitToAdmin}
            onResubmit={handleResubmit}
            submitting={submitting}
          />
          {showFinance && (
            <CaseFinance
              caseId={caseData.id}
              canManage={role === "admin" || role === "team_member"}
              canConfirm={role === "admin"}
              showGermany={role === "admin" || caseData.status === "submitted" || caseData.status === "enrollment_paid"}
            />
          )}

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

      {canManage && user && (
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("case.tasks.action.confirmPayment")}</DialogTitle>
              <DialogDescription>{t("case.tasks.confirmPaymentDesc")}</DialogDescription>
            </DialogHeader>
            <PaymentConfirmationForm
              caseId={caseData.id}
              actorId={user.id}
              actorName={user.email ?? ""}
              onSuccess={() => {
                setPaymentOpen(false);
                void fetchData();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

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
