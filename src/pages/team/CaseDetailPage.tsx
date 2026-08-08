import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePipelineStatuses } from "@/hooks/usePipelineStatuses";
import { statusColorClasses } from "@/lib/caseStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, CalendarPlus, Download, Phone, Send } from "lucide-react";

import { advanceCaseStage, manualNextStages } from "@/services/CaseStageService";
import CaseProgressRail from "@/components/cases/CaseProgressRail";
import CaseAttentionPanel from "@/components/cases/CaseAttentionPanel";
import { deriveCaseTasks, type CaseTask } from "@/components/cases/caseTasks";
import CaseStudentTab from "@/components/cases/CaseStudentTab";
import CaseProgramTab from "@/components/cases/CaseProgramTab";
import CaseMessages from "@/components/cases/CaseMessages";

import CaseFinance from "@/components/cases/CaseFinance";
import CaseTimeline from "@/components/cases/CaseTimeline";
import AppointmentSchedulerModal from "@/components/team/AppointmentSchedulerModal";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import PaymentConfirmationForm from "@/components/team/PaymentConfirmationForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CaseRow {
  id: string;
  case_reference: string | null;
  full_name: string;
  phone_number: string;
  status: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
  [key: string]: unknown;
}

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  outcome: string | null;
  notes: string | null;
}

interface DocumentRow {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  created_at: string;
}

const DATE_LOCALE = "en-US";
const REQUIRED_DOC_COUNT = 6;

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const { statuses } = usePipelineStatuses();
  const isRtl = i18n.dir() === "rtl";

  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [programLabel, setProgramLabel] = useState<string | null>(null);
  const [accommodationLabel, setAccommodationLabel] = useState<string | null>(null);
  const [insuranceLabel, setInsuranceLabel] = useState<string | null>(null);
  const [forgottenDays, setForgottenDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("case");

  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const documentsRef = useRef<HTMLDivElement | null>(null);

  const canManage = role === "admin" || role === "team_member";

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes, docsRes, settingsRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase
          .from("appointments")
          .select("*")
          .eq("case_id", id)
          .order("scheduled_at", { ascending: false }),
        supabase.from("case_submissions").select("*").eq("case_id", id).maybeSingle(),
        supabase.from("documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
        supabase.from("platform_settings").select("forgotten_contacted_days").maybeSingle(),
      ]);

      if (caseRes.error) throw caseRes.error;
      const row = caseRes.data as unknown as CaseRow;
      setCaseData(row);
      setAppointments((apptRes.data as AppointmentRow[]) ?? []);
      setSubmission(subRes.data ?? null);
      setDocuments((docsRes.data as DocumentRow[]) ?? []);
      if (settingsRes.data?.forgotten_contacted_days) {
        setForgottenDays(settingsRes.data.forgotten_contacted_days);
      }

      if (row.assigned_to) {
        const { data: staff } = await supabase.rpc("get_staff_directory");
        const match = (staff as { id: string; full_name: string }[] | null)?.find(
          (s) => s.id === row.assigned_to,
        );
        setAssigneeName(match?.full_name ?? null);
      } else {
        setAssigneeName(null);
      }

      const sub = subRes.data as any;
      const [prog, accom, ins] = await Promise.all([
        sub?.program_id
          ? supabase.from("programs").select("name_ar, name_en").eq("id", sub.program_id).maybeSingle()
          : Promise.resolve({ data: null }),
        sub?.accommodation_id
          ? supabase
              .from("accommodations")
              .select("name_ar, name_en")
              .eq("id", sub.accommodation_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        sub?.insurance_id
          ? supabase.from("insurances").select("name").eq("id", sub.insurance_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const pick = (r: any) => (r ? (isRtl ? r.name_ar || r.name_en : r.name_en || r.name_ar) : null);
      setProgramLabel(pick(prog?.data));
      setAccommodationLabel(pick(accom?.data));
      setInsuranceLabel((ins?.data as any)?.name ?? null);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast, isRtl]);

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
      case "upload_document":
        setTab("history");
        requestAnimationFrame(() => documentsRef.current?.scrollIntoView({ behavior: "smooth" }));
        break;
      case "add_note":
        setTab("history");
        break;
    }
  };

  const nextStages = useMemo(
    () => (caseData ? manualNextStages(caseData.status) : []),
    [caseData],
  );

  const handleAdvance = async () => {
    if (!caseData || !pendingStage) return;
    setAdvancing(true);
    try {
      await advanceCaseStage(caseData.id, caseData.status, pendingStage);
      toast({ description: t("case.stage.moved", "Case moved to the next stage") });
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

  const canSubmitToAdmin =
    canManage &&
    !!submission &&
    !!submission.payment_confirmed &&
    caseData?.status !== "submitted" &&
    caseData?.status !== "payment_confirmed" &&
    caseData?.status !== "enrollment_paid";

  const handleSubmitToAdmin = async () => {
    if (!caseData || !submission || !user) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error: subErr } = await supabase
        .from("case_submissions")
        .update({ submitted_at: now, submitted_by: user.id, review_status: "submitted", review_note: null })
        .eq("id", submission.id);
      if (subErr) throw subErr;
      const { error: caseErr } = await supabase
        .from("cases")
        .update({ status: "submitted" })
        .eq("id", caseData.id);
      if (caseErr) throw caseErr;
      toast({ description: t("case.submit.success", "Sent to admin for review") });
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("case.detail.loading", "Loading...")}
      </div>
    );
  }

  if (!caseData) {
    return <div className="p-6 text-muted-foreground">{t("case.detail.notFound", "Case not found")}</div>;
  }

  const statusMeta = statuses.find((s) => s.key === caseData.status);
  const nextAppt = appointments
    .filter((a) => !a.outcome && new Date(a.scheduled_at).getTime() >= Date.now())
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0];
  const Back = isRtl ? ArrowRight : ArrowLeft;
  const notSet = t("case.overview.notSet", "Not set yet");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(DATE_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const summary: { label: string; value: string | null }[] = [
    { label: t("case.detail.program", "Program"), value: programLabel },
    { label: t("case.detail.accommodation", "Accommodation"), value: accommodationLabel },
    { label: t("case.detail.insurance", "Insurance"), value: insuranceLabel },
    {
      label: t("case.detail.paymentStatus", "Payment Status"),
      value: submission?.payment_confirmed
        ? t("case.overview.paymentConfirmed", "Confirmed")
        : t("case.overview.paymentPending", "Awaiting confirmation"),
    },
    {
      label: t("case.detail.documents", "Documents"),
      value: t("case.overview.docsCount", {
        count: documents.length,
        total: REQUIRED_DOC_COUNT,
        defaultValue: "{{count}} of {{total}} uploaded",
      }),
    },
    {
      label: t("case.overview.nextAppointment", "Next appointment"),
      value: nextAppt ? fmtDate(nextAppt.scheduled_at) : null,
    },
  ];

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
              aria-label={t("common.back", "Back")}
            >
              <Back className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-medium">{caseData.full_name}</h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {caseData.case_reference ?? `#${caseData.id.slice(0, 8)}`}
                {" · "}
                {assigneeName
                  ? t("case.header.assignedTo", { name: assigneeName, defaultValue: "Assigned to {{name}}" })
                  : t("case.header.unassigned", "Unassigned")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={`tel:${caseData.phone_number}`}>
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("case.header.call", "Call")}</span>
              </a>
            </Button>
            {canManage && (
              <Button size="sm" className="gap-1.5" onClick={() => setSchedulerOpen(true)}>
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("case.header.schedule", "Schedule")}</span>
              </Button>
            )}
            {canManage && caseData.status !== "enrollment_paid" && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={!canSubmitToAdmin || submitting}
                title={
                  canSubmitToAdmin
                    ? undefined
                    : t("case.submit.blocked", "Complete the profile and confirm payment first")
                }
                onClick={handleSubmitToAdmin}
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("case.submit.action", "Submit to admin")}</span>
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
          <CaseProgressRail
            statuses={statuses}
            currentKey={caseData.status}
            nextStages={canManage ? nextStages : undefined}
            onAdvance={canManage ? (key) => setPendingStage(key) : undefined}
            advancing={advancing}
          />
        </div>
      </div>

      {canManage && submission?.review_status === "changes_requested" && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-700">
            {t("case.submit.changesRequested", "Admin requested changes")}
          </p>
          {submission.review_note && (
            <p className="mt-1 text-sm text-muted-foreground">{submission.review_note}</p>
          )}
        </div>
      )}

      {canManage && <CaseAttentionPanel tasks={tasks} onAction={handleTask} />}

      {/* Section tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="case">{t("case.tabs.case", "Case")}</TabsTrigger>
          <TabsTrigger value="program">{t("case.tabs.programFinance", "Program & Finance")}</TabsTrigger>
          <TabsTrigger value="messages">{t("case.tabs.messages", "Messages")}</TabsTrigger>
          <TabsTrigger value="history">{t("case.tabs.history", "History")}</TabsTrigger>
        </TabsList>


        <TabsContent value="case" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("case.detail.keyFacts", "Key facts")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {summary.map((row) => (
                <div key={row.label}>
                  <p className="mb-0.5 text-[11px] text-muted-foreground">{row.label}</p>
                  <p className={`text-sm ${row.value ? "text-foreground" : "text-muted-foreground"}`}>
                    {row.value ?? notSet}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">{t("case.tabs.student", "Student")}</CardTitle>
            </CardHeader>
            <CaseStudentTab caseData={caseData} submission={submission} onRefresh={fetchData} />
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("case.detail.appointments", "Appointments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("case.detail.noAppointments", "No appointments yet")}
                </p>
              ) : (
                <div className="divide-y">
                  {appointments.map((appt) => (
                    <div key={appt.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{fmtDate(appt.scheduled_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          {appt.outcome
                            ? t(`team.outcome.${appt.outcome}`, appt.outcome)
                            : t("case.detail.pendingOutcome", "Pending")}
                        </p>
                      </div>
                      {canManage && !appt.outcome && (
                        <Button size="sm" variant="outline" onClick={() => setOutcomeApptId(appt.id)}>
                          {t("case.tasks.action.recordOutcome", "Record outcome")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="program" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">{t("case.tabs.program", "Program")}</CardTitle>
            </CardHeader>
            <CaseProgramTab submission={submission} onRefresh={fetchData} />
          </Card>
          <CaseFinance caseId={caseData.id} canManage={canManage} />
        </TabsContent>

        <TabsContent value="messages" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("case.messages.title", "Messages")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseMessages caseId={caseData.id} allowInternal={canManage} />
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="history" className="mt-3 space-y-3">
          <CaseTimeline caseId={caseData.id} canAddNote={canManage} />
          <Card ref={documentsRef}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("case.detail.documents", "Documents")}</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("case.overview.noDocuments", "No documents uploaded yet")}
                </p>
              ) : (
                <div className="divide-y">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(`case.docCategory.${doc.category}`, doc.category)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5" />
                          <span className="sr-only">{t("case.detail.download", "Download")}</span>
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Modals */}
      {canManage && user && (
        <AppointmentSchedulerModal
          open={schedulerOpen}
          onClose={() => setSchedulerOpen(false)}
          caseId={caseData.id}
          teamMemberId={caseData.assigned_to ?? user.id}
          actorName={user.email ?? ""}
          guestName={caseData.full_name}
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
              <DialogTitle>{t("case.tasks.action.confirmPayment", "Confirm payment")}</DialogTitle>
              <DialogDescription>
                {t("case.tasks.confirmPaymentDesc", "Record the received service fee for this case.")}
              </DialogDescription>
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
                <DialogTitle>
                  {t("case.stage.confirmTitle", { stage: target, defaultValue: "Move to {{stage}}" })}
                </DialogTitle>
                <DialogDescription>
                  {t("case.stage.confirmBody", {
                    from: stageLabel(caseData.status),
                    to: target,
                    defaultValue:
                      "This case moves from {{from}} to {{to}}. The change is recorded on the case timeline and is visible to the student.",
                  })}
                </DialogDescription>
              </DialogHeader>
            );
          })()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingStage(null)} disabled={advancing}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleAdvance} disabled={advancing}>
              {advancing
                ? t("case.stage.confirmPending", "Moving…")
                : t("case.stage.confirmAction", "Move")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
