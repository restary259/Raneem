import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Phone,
  Clock,
  Calendar,
  FileText,
  User,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  CheckCircle2,
  CalendarClock,
  CreditCard,
  SendHorizonal,
  GraduationCap,
  Trash2,
  Download,
  StickyNote,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import AppointmentSchedulerModal from "@/components/team/AppointmentSchedulerModal";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import ProfileCompletionForm from "@/components/team/ProfileCompletionForm";
import PaymentConfirmationForm from "@/components/team/PaymentConfirmationForm";
import RescheduleDialog from "@/components/team/RescheduleDialog";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
  is_no_show: boolean;
  student_user_id: string | null;
  partner_id: string | null;
  city: string | null;
  education_level: string | null;
  bagrut_score: number | null;
  english_level: string | null;
  english_units: number | null;
  math_units: number | null;
  passport_type: string | null;
  degree_interest: string | null;
  intake_notes: string | null;
  created_by_team: boolean;
}
interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  outcome: string | null;
  notes: string | null;
  outcome_notes: string | null;
}
interface Submission {
  id: string;
  program_id: string | null;
  accommodation_id: string | null;
  program_start_date: string | null;
  program_end_date: string | null;
  service_fee: number;
  translation_fee: number;
  payment_confirmed: boolean;
  extra_data: Record<string, unknown> | null;
  submitted_at: string | null;
  program_price: number;
  accommodation_price: number;
  insurance_price: number;
}
interface Document {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string;
  created_at: string;
  notes: string | null;
}
interface ResolvedNames {
  programName: string | null;
  schoolName: string | null;
  accommodationName: string | null;
  accommodationPrice: number | null;
  insuranceName: string | null;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  appointment_scheduled: "bg-purple-100 text-purple-800",
  profile_completion: "bg-orange-100 text-orange-800",
  payment_confirmed: "bg-emerald-100 text-emerald-800",
  submitted: "bg-teal-100 text-teal-800",
  enrollment_paid: "bg-green-100 text-green-800",
  forgotten: "bg-red-100 text-red-800",
};
const OUTCOME_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  rescheduled: "bg-blue-100 text-blue-800",
  delayed: "bg-yellow-100 text-yellow-800",
  no_show: "bg-orange-100 text-orange-800",
};
const PIPELINE_STAGES = [
  "new",
  "contacted",
  "appointment_scheduled",
  "profile_completion",
  "payment_confirmed",
  "submitted",
  "enrollment_paid",
];
const PIPELINE_LABELS: Record<string, string> = {
  new: "case.status.new",
  contacted: "case.status.contacted",
  appointment_scheduled: "case.status.appointment_scheduled",
  profile_completion: "case.status.profile_completion",
  payment_confirmed: "case.status.payment_confirmed",
  submitted: "case.status.submitted",
  enrollment_paid: "case.status.enrollment_paid",
};
const STRICT_NEXT: Record<string, string> = {
  new: "contacted",
  contacted: "appointment_scheduled",
  appointment_scheduled: "profile_completion",
  profile_completion: "payment_confirmed",
  payment_confirmed: "submitted",
  submitted: "enrollment_paid",
};

// Keys in extra_data that are UUIDs / internal IDs — resolved separately, skip raw display
const SKIP_EXTRA_KEYS = new Set([
  "program_id",
  "school_id",
  "accommodation_id",
  "insurance_id",
  "documents_skipped",
  "age",
]);

/* ─── Small reusable components (module-level to prevent focus loss) ── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function AdminNotesCard({ initialNotes }: { caseId: string; initialNotes: string | null; onSaved: () => void }) {
  if (!initialNotes) return null;
  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-600" /> Admin Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {initialNotes}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Editable field for Review step ─────────────────────────────────── */
const EditableField = ({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    onSave(draft);
    setEditing(false);
  };
  if (editing)
    return (
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
        <div className="flex gap-1">
          <Input
            className="h-7 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
          <Button size="sm" className="h-7 px-2" onClick={commit}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  return (
    <div className="group flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium flex-1 truncate">{value || "—"}</span>
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════ */
export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [resolved, setResolved] = useState<ResolvedNames>({
    programName: null,
    schoolName: null,
    accommodationName: null,
    accommodationPrice: null,
    insuranceName: null,
  });
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [profileJustSaved, setProfileJustSaved] = useState(false);

  // Edit extra_data in review
  const [editedExtra, setEditedExtra] = useState<Record<string, string>>({});

  // Dialog states
  const [showScheduler, setShowScheduler] = useState(false);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showDeleteCase, setShowDeleteCase] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);
  const [deletingAppt, setDeletingAppt] = useState(false);

  /* ── Data fetching ─────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes] = await Promise.all([
        supabase.from("cases").select("*").eq("id", id).single(),
        supabase.from("appointments").select("*").eq("case_id", id).order("scheduled_at", { ascending: false }),
        supabase.from("case_submissions").select("*").eq("case_id", id).maybeSingle(),
      ]);
      if (caseRes.error) throw caseRes.error;
      setCaseData(caseRes.data as unknown as Case);
      setAppointments((apptRes.data as Appointment[]) ?? []);
      const sub = subRes.data as unknown as Submission | null;
      setSubmission(sub);

      // Initialise editable copy of extra_data
      if (sub?.extra_data) {
        const stringified: Record<string, string> = {};
        Object.entries(sub.extra_data).forEach(([k, v]) => {
          stringified[k] = v ? String(v) : "";
        });
        setEditedExtra(stringified);
      }

      // Resolve UUIDs → names
      if (sub) {
        const ex = sub.extra_data ?? {};
        const programId = (sub.program_id || ex.program_id || null) as string | null;
        const schoolId = (ex.school_id || null) as string | null;
        const accommodationId = (sub.accommodation_id || ex.accommodation_id || null) as string | null;
        const insuranceId = (ex.insurance_id || null) as string | null;

        const [progRes, schoolRes, accomRes, insRes] = await Promise.all([
          programId ? (supabase as any).from("programs").select("name_en").eq("id", programId).maybeSingle() : null,
          schoolId ? (supabase as any).from("schools").select("name_en").eq("id", schoolId).maybeSingle() : null,
          accommodationId
            ? (supabase as any)
                .from("accommodations")
                .select("name_en,price,currency")
                .eq("id", accommodationId)
                .maybeSingle()
            : null,
          insuranceId ? (supabase as any).from("insurances").select("name").eq("id", insuranceId).maybeSingle() : null,
        ]);
        setResolved({
          programName: progRes?.data?.name_en ?? null,
          schoolName: schoolRes?.data?.name_en ?? null,
          accommodationName: accomRes?.data?.name_en ?? null,
          accommodationPrice: accomRes?.data?.price ?? null,
          insuranceName: insRes?.data?.name ?? null,
        });
      }

      const { data: docsData } = await supabase
        .from("documents")
        .select("*")
        .eq("case_id", id)
        .order("created_at", { ascending: false });
      setDocuments((docsData as Document[]) ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Status update ─────────────────────────────────────────────────── */
  const updateStatus = async (newStatus: string, force = false) => {
    if (!caseData) return;
    if (!force) {
      const allowed = STRICT_NEXT[caseData.status];
      if (allowed !== newStatus) {
        toast({
          variant: "destructive",
          description: `Cannot skip stages. Next allowed: ${allowed?.replace(/_/g, " ") ?? "none"}`,
        });
        return;
      }
    }
    setUpdatingStatus(true);
    try {
      await supabase.from("cases").update({ status: newStatus }).eq("id", caseData.id);
      toast({ title: `Status updated to ${newStatus.replace(/_/g, " ")}` });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* ── Save edited extra_data field ──────────────────────────────────── */
  const saveExtraField = async (key: string, value: string) => {
    if (!submission) return;
    const updated = { ...editedExtra, [key]: value };
    setEditedExtra(updated);
    // Convert back to original types where possible
    const merged = { ...(submission.extra_data ?? {}) };
    merged[key] = value;
    try {
      await (supabase as any).from("case_submissions").update({ extra_data: merged }).eq("id", submission.id);
      toast({ title: "Field updated" });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    }
  };

  /* ── Delete case ───────────────────────────────────────────────────── */
  const handleDeleteCase = async () => {
    if (!caseData) return;
    setDeletingCase(true);
    try {
      await supabase.from("documents").delete().eq("case_id", caseData.id);
      await supabase.from("appointments").delete().eq("case_id", caseData.id);
      await supabase.from("case_submissions").delete().eq("case_id", caseData.id);
      await supabase.from("cases").delete().eq("id", caseData.id);
      toast({ title: "Case deleted" });
      navigate("/team/cases");
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setDeletingCase(false);
      setShowDeleteCase(false);
    }
  };

  /* ── Delete appointment ────────────────────────────────────────────── */
  const handleDeleteAppointment = async () => {
    if (!deleteApptId) return;
    setDeletingAppt(true);
    try {
      await supabase.from("appointments").delete().eq("id", deleteApptId);
      toast({ title: "Appointment deleted" });
      setDeleteApptId(null);
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setDeletingAppt(false);
    }
  };

  /* ── Derived ───────────────────────────────────────────────────────── */
  const pendingAppt = appointments.find((a) => !a.outcome) ?? null;
  const profileIsReady = !!submission;
  const currentStageIdx = PIPELINE_STAGES.indexOf(caseData?.status ?? "");
  const isTerminal = caseData?.status === "enrollment_paid" || caseData?.status === "cancelled";

  // Financial summary
  const programTotal = submission?.program_price ?? 0;
  const accomTotal = submission?.accommodation_price ?? 0;
  const insTotal = submission?.insurance_price ?? 0;
  const serviceFee = submission?.service_fee ?? 0;
  const grandTotal = programTotal + accomTotal + insTotal + serviceFee;
  const amountPaid = submission?.payment_confirmed ? serviceFee : 0;
  const remaining = grandTotal - amountPaid;

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("case.detail.loading")}</div>;
  if (!caseData) return <div className="p-6 text-muted-foreground">{t("case.detail.notFound")}</div>;

  /* ── Pipeline bar ──────────────────────────────────────────────────── */
  const PipelineBar = () => (
    <Card className="mb-2">
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isDone = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            const isFuture = idx > currentStageIdx;
            return (
              <React.Fragment key={stage}>
                {idx > 0 && <div className={`h-0.5 flex-1 min-w-[8px] ${isDone ? "bg-primary" : "bg-border"}`} />}
                <div className={`flex flex-col items-center gap-0.5 shrink-0 ${isFuture ? "opacity-40" : ""}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${isDone ? "bg-primary border-primary text-primary-foreground" : ""} ${isCurrent ? "bg-primary/10 border-primary text-primary" : ""} ${isFuture ? "bg-muted border-border text-muted-foreground" : ""}`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] hidden sm:block ${isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}
                  >
                    {t(PIPELINE_LABELS[stage], stage)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  /* ── Next Action panel ─────────────────────────────────────────────── */
  const renderNextAction = () => {
    const { status } = caseData;
    if (status === "new")
      return (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">{t("case.detail.markContacted")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("case.detail.markContactedDesc")}
            </p>
          </div>
          <Button onClick={() => updateStatus("contacted")} disabled={updatingStatus} className="shrink-0">
            {t("case.detail.markContacted")} <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        </div>
      );
    if (status === "contacted")
      return (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">{t("case.detail.scheduleAppt")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("case.detail.scheduleApptDesc")}</p>
          </div>
          <Button onClick={() => setShowScheduler(true)} className="shrink-0">
            <CalendarClock className="h-4 w-4 me-1" /> {t("lawyer.schedule")}
          </Button>
        </div>
      );
    if (status === "appointment_scheduled") {
      if (pendingAppt)
        return (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm flex items-center gap-1.5 min-w-0">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">
                    {new Date(pendingAppt.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </p>
                {pendingAppt.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words overflow-hidden">{pendingAppt.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-start">
                <Button size="sm" variant="outline" onClick={() => setRescheduleAppt(pendingAppt)}>
                  {t("case.detail.reschedule")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setDeleteApptId(pendingAppt.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" onClick={() => setOutcomeApptId(pendingAppt.id)}>
                  {t("case.detail.outcome")} <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </div>
          </div>
        );
      return (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm text-amber-700">{t("case.detail.allOutcomesRecorded")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("case.detail.proceedToProfile")}</p>
          </div>
          <Button size="sm" onClick={() => updateStatus("profile_completion")} disabled={updatingStatus}>
            {t("case.detail.completeProfile")} <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        </div>
      );
    }
    if (status === "profile_completion") {
      if (!profileIsReady && !profileJustSaved)
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <p className="font-medium text-sm">{t("case.detail.completeProfile")}</p>
            </div>
            <ProfileCompletionForm
              caseId={caseData.id}
              actorId={user!.id}
              actorName="Team Member"
              existingData={submission?.extra_data ?? {}}
              caseData={caseData}
              onSuccess={() => {
                setProfileJustSaved(true);
                fetchData();
              }}
            />
          </div>
        );
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 font-medium">{t("case.detail.profileComplete")}</p>
          </div>
          <PaymentConfirmationForm
            caseId={caseData.id}
            actorId={user!.id}
            actorName="Team Member"
            onSuccess={fetchData}
          />
        </div>
      );
    }
    if (status === "payment_confirmed")
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CreditCard className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">{t("case.detail.confirmPayment")}</p>
          </div>
          {submission && (
            <div className="text-sm space-y-1 px-1">
              {resolved.programName && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.detail.program")}</span>
                  <span className="font-medium text-foreground">{resolved.programName}</span>
                </div>
              )}
              {submission.program_price > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.detail.programCost")}</span>
                  <span className="font-medium text-foreground">{submission.program_price.toLocaleString()} EUR</span>
                </div>
              )}
              {submission.accommodation_price > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.detail.accommodation")}</span>
                  <span className="font-medium text-foreground">
                    {submission.accommodation_price.toLocaleString()} EUR
                  </span>
                </div>
              )}
              {submission.service_fee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.detail.serviceFee")}</span>
                  <span className="font-medium text-foreground">{submission.service_fee.toLocaleString()} ILS</span>
                </div>
              )}
              {submission.program_start_date && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.detail.startDate")}</span>
                  <span>{submission.program_start_date}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={updatingStatus}>
              <SendHorizonal className="h-4 w-4 me-1" /> {t("case.detail.submitToAdmin")}
            </Button>
          </div>
        </div>
      );
    if (status === "submitted")
      return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
          <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">{t("case.detail.submittedToAdmin")}</p>
            <p className="text-xs text-teal-700 mt-0.5">{t("case.detail.waitingAdminReview")}</p>
          </div>
        </div>
      );
    if (status === "enrollment_paid")
      return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <GraduationCap className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">{t("case.detail.studentEnrolled")}</p>
            <p className="text-xs text-green-700 mt-0.5">{t("case.detail.caseComplete")}</p>
          </div>
        </div>
      );
    if (status === "forgotten")
      return (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-destructive">{t("case.detail.forgottenCase")}</p>
          <Button variant="outline" onClick={() => updateStatus("contacted", true)}>
            {t("case.detail.reactivate")}
          </Button>
        </div>
      );
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <PipelineBar />

      {/* ── Header ── */}
      <div className="space-y-2" dir="ltr">
        {/* Row 1: back + name */}
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0 -ms-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0 flex-1">{caseData.full_name}</h1>
        </div>

        {/* Row 2: phone + timestamp */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap ps-1">
          <a
            href={`tel:${caseData.phone_number}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium text-xs shrink-0"
          >
            <Phone className="h-3 w-3" />
            {caseData.phone_number}
          </a>
          <CopyButton value={caseData.phone_number} />
          <span className="text-muted-foreground/40">·</span>
          <Clock className="h-3 w-3 shrink-0" />
          <span dir="ltr" className="inline-block whitespace-nowrap text-xs">
            {formatDistanceToNow(new Date(caseData.last_activity_at), { addSuffix: true })}
          </span>
        </div>

        {/* Row 3: status badges + delete */}
        <div className="flex items-center gap-2 flex-wrap justify-between ps-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={STATUS_COLORS[caseData.status] ?? "bg-muted"}>{caseData.status.replace(/_/g, " ")}</Badge>
            {caseData.student_user_id && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <User className="h-3 w-3" />
                {t("case.detail.accountActive")}
              </Badge>
            )}
          </div>
          {!isTerminal && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
              onClick={() => setShowDeleteCase(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("case.detail.deleteCase")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Application Info — only show for cases from the student application form ── */}
      {!caseData.created_by_team && (
        <Card>
          <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> {t("case.detail.appInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {caseData.education_level ||
            caseData.english_units != null ||
            caseData.math_units != null ||
            caseData.english_level ||
            caseData.passport_type ||
            caseData.city ||
            caseData.degree_interest ||
            caseData.bagrut_score != null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                {caseData.city && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.cityLabel")}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium">{caseData.city}</p>
                      <CopyButton value={caseData.city} />
                    </div>
                  </div>
                )}
                {caseData.passport_type && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.passportType")}</p>
                    <p className="text-sm font-medium capitalize">{caseData.passport_type.replace(/_/g, " ")}</p>
                  </div>
                )}
                {caseData.education_level && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.educationLevel")}</p>
                    <p className="text-sm font-medium">{caseData.education_level}</p>
                  </div>
                )}
                {caseData.english_units != null && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.englishUnits")}</p>
                    <p className="text-2xl font-bold text-primary leading-none">{caseData.english_units}</p>
                  </div>
                )}
                {caseData.math_units != null && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.mathUnits")}</p>
                    <p className="text-2xl font-bold text-primary leading-none">{caseData.math_units}</p>
                  </div>
                )}
                {caseData.english_level && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.englishProficiency")}</p>
                    <p className="text-sm font-medium capitalize">{caseData.english_level}</p>
                  </div>
                )}
                {caseData.bagrut_score != null && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Bagrut Score</p>
                    <p className="text-2xl font-bold text-primary leading-none">{caseData.bagrut_score}</p>
                  </div>
                )}
                {caseData.degree_interest && (
                  <div className="space-y-0.5 col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">{t("case.detail.preferredMajor")}</p>
                    <p className="text-sm font-medium">{caseData.degree_interest}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("case.detail.noAppData")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <AdminNotesCard caseId={caseData.id} initialNotes={caseData.intake_notes} onSaved={fetchData} />

      {/* ── Student Profile — resolved names + editable extra_data ── */}
      {submission?.extra_data && Object.keys(submission.extra_data).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> {t("case.detail.studentProfile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resolved lookup names (not raw UUIDs) */}
            {(resolved.programName || resolved.schoolName || resolved.accommodationName || resolved.insuranceName) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3 border-b border-border">
                {resolved.programName && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.program")}</p>
                    <p className="text-sm font-medium">{resolved.programName}</p>
                  </div>
                )}
                {resolved.schoolName && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.school")}</p>
                    <p className="text-sm font-medium">{resolved.schoolName}</p>
                  </div>
                )}
                {resolved.accommodationName && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.accommodation")}</p>
                    <p className="text-sm font-medium">
                      {resolved.accommodationName}
                      {resolved.accommodationPrice ? ` — ${resolved.accommodationPrice.toLocaleString()}/mo` : ""}
                    </p>
                  </div>
                )}
                {resolved.insuranceName && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("case.detail.insurance")}</p>
                    <p className="text-sm font-medium">{resolved.insuranceName}</p>
                  </div>
                )}
              </div>
            )}
            {/* Editable text fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(submission.extra_data).map(([key, val]) => {
                if (SKIP_EXTRA_KEYS.has(key)) return null;
                if (!val && val !== 0) return null;
                const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                return (
                  <EditableField
                    key={key}
                    label={label}
                    value={editedExtra[key] ?? String(val)}
                    onSave={(v) => saveExtraField(key, v)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Financial Summary ── */}
      {submission && grandTotal > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> {t("case.detail.financialSummary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {programTotal > 0 && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate flex-1 min-w-0">{t("case.detail.program")}{resolved.programName ? ` (${resolved.programName})` : ""}</span>
                <span className="font-medium text-foreground shrink-0 whitespace-nowrap">{programTotal.toLocaleString("en-US")} EUR</span>
              </div>
            )}
            {accomTotal > 0 && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate flex-1 min-w-0">{t("case.detail.accommodation")}{resolved.accommodationName ? ` (${resolved.accommodationName})` : ""}</span>
                <span className="font-medium text-foreground shrink-0 whitespace-nowrap">{accomTotal.toLocaleString("en-US")} EUR</span>
              </div>
            )}
            {insTotal > 0 && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate flex-1 min-w-0">{t("case.detail.insurance")}{resolved.insuranceName ? ` (${resolved.insuranceName})` : ""}</span>
                <span className="font-medium text-foreground shrink-0 whitespace-nowrap">{insTotal.toLocaleString("en-US")} EUR</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate flex-1 min-w-0">{t("case.detail.serviceFee")}</span>
                <span className="font-medium text-foreground shrink-0 whitespace-nowrap">{serviceFee.toLocaleString("en-US")} ILS</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-2 font-semibold text-base">
              <span className="truncate flex-1 min-w-0">{t("case.detail.total")}</span>
              <span className="shrink-0 whitespace-nowrap">{grandTotal.toLocaleString("en-US")}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.amountPaid")}</span>
              <span className={`shrink-0 whitespace-nowrap ${amountPaid > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                {amountPaid.toLocaleString("en-US")} ILS
              </span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.remaining")}</span>
                <span className="text-amber-600 font-medium shrink-0 whitespace-nowrap">{remaining.toLocaleString("en-US")}</span>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-1">
              <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.paymentStatus")}</span>
              <span className={`shrink-0 whitespace-nowrap ${submission.payment_confirmed ? "text-green-600 font-medium" : "text-amber-600"}`}>
                {submission.payment_confirmed ? t("case.detail.paymentConfirmed") : t("case.detail.paymentPending")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Next Action ── */}
      <Card className="border-primary/30 bg-primary/5 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("case.detail.nextAction")}</CardTitle>
        </CardHeader>
        <CardContent>{renderNextAction()}</CardContent>
      </Card>

      {/* ── Appointments + Course cards ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {caseData.status !== "new" && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {t("case.detail.appointments")}
              </CardTitle>
              {!["submitted", "enrollment_paid"].includes(caseData.status) && (
                <Button size="sm" variant="outline" onClick={() => setShowScheduler(true)}>
                  {t("case.detail.addAppointment")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("case.detail.noAppointments")}</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col sm:flex-row items-start justify-between gap-2 pb-3 last:pb-0 border-b last:border-b-0 border-border"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {new Date(a.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {a.outcome ? (
                            <Badge
                              className={`text-xs ${OUTCOME_COLORS[a.outcome] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {a.outcome}
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{t("case.detail.pendingOutcome")}</Badge>
                          )}
                          {a.outcome_notes && (
                            <span className="text-xs text-muted-foreground block max-w-[200px] truncate">{a.outcome_notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 flex-wrap">
                        {!a.outcome && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setRescheduleAppt(a)}
                            >
                              {t("case.detail.reschedule")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setOutcomeApptId(a.id)}
                            >
                              {t("case.detail.outcome")}
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteApptId(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {submission && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> {t("case.detail.courseProgram")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {resolved.programName && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.program")}</span>
                  <span className="font-medium shrink-0 whitespace-nowrap max-w-[50%] truncate">{resolved.programName}</span>
                </div>
              )}
              {resolved.schoolName && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.school")}</span>
                  <span className="font-medium shrink-0 whitespace-nowrap max-w-[50%] truncate">{resolved.schoolName}</span>
                </div>
              )}
              {resolved.accommodationName && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.accommodation")}</span>
                  <span className="font-medium shrink-0 whitespace-nowrap max-w-[50%] truncate">{resolved.accommodationName}</span>
                </div>
              )}
              {submission.program_start_date && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.startDate")}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="whitespace-nowrap">{submission.program_start_date}</span>
                    <CopyButton value={submission.program_start_date} />
                  </div>
                </div>
              )}
              {submission.program_end_date && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.endDate")}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="whitespace-nowrap">{submission.program_end_date}</span>
                    <CopyButton value={submission.program_end_date} />
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.payment")}</span>
                <span className={`shrink-0 whitespace-nowrap ${submission.payment_confirmed ? "text-green-600 font-medium" : "text-amber-600"}`}>
                  {submission.payment_confirmed ? t("case.detail.paymentConfirmed") : t("case.detail.paymentPending")}
                </span>
              </div>
              {submission.submitted_at && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate flex-1 min-w-0">{t("case.detail.submitted")}</span>
                  <span className="shrink-0 whitespace-nowrap">{new Date(submission.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Documents ── */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("case.detail.documents")} ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.category} · {format(new Date(doc.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noreferrer">
                   <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0">
                      <Download className="h-3.5 w-3.5" /> {t("case.detail.download")}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modals ── */}
      {showScheduler && user && (
        <AppointmentSchedulerModal
          open={showScheduler}
          onClose={() => setShowScheduler(false)}
          caseId={caseData.id}
          teamMemberId={user.id}
          actorName="Team Member"
          onSuccess={fetchData}
        />
      )}
      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchData}
        />
      )}
      <RescheduleDialog appointment={rescheduleAppt} onClose={() => setRescheduleAppt(null)} refetch={fetchData} />

      {/* Submit confirm */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("case.detail.submitCaseTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("case.detail.submitCaseDesc")}
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">{t("case.detail.submitWarning")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              {t("case.detail.cancel")}
            </Button>
            <Button
              onClick={async () => {
                setShowSubmitConfirm(false);
                await supabase.from("cases").update({ status: "submitted" }).eq("id", caseData!.id);
                await supabase
                  .from("case_submissions")
                  .update({ submitted_at: new Date().toISOString(), submitted_by: user!.id })
                  .eq("case_id", caseData!.id);
                fetchData();
              }}
              disabled={updatingStatus}
            >
              {t("case.detail.confirmSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete case */}
      <AlertDialog open={showDeleteCase} onOpenChange={setShowDeleteCase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t("case.detail.deleteCase")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("case.detail.deleteCaseDesc", { name: caseData.full_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("case.detail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCase}
              disabled={deletingCase}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCase ? t("case.detail.deleting") : t("case.detail.deleteCase")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete appointment */}
      <AlertDialog open={!!deleteApptId} onOpenChange={() => setDeleteApptId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t("case.detail.deleteApptTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("case.detail.deleteApptDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("case.detail.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAppointment}
              disabled={deletingAppt}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAppt ? t("case.detail.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
