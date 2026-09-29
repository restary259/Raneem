import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorState, LoadingState, SectionCard } from "@/components/shell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Mail,
  Phone,
  GraduationCap,
  StickyNote,
  UserCheck,
  Plane,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVisaDetail } from "@/hooks/useVisaDetail";
import { useAuth } from "@/contexts/AuthContext";
import {
  attachVisaDocument,
  createVisaDocumentUrl,
  detachVisaDocument,
  downloadVisaDocument,
  ensureVisaApplication,
  markStudentArrived,
  saveVisaFieldValues,
  saveVisaNotes,
  setVisaStatus,
  updateActualArrival,
  visaErrMsg,
  type VisaDocument,
  type VisaQueueRow,
} from "@/services/VisaService";
import {
  normalizeVisaStatus,
  VISA_STATUSES,
  type VisaStatus,
} from "@/lib/visaStatus";
import VisaStatusBadge from "./VisaStatusBadge";
import VisaArrivalPanel from "./VisaArrivalPanel";
import VisaInformationPanel from "./VisaInformationPanel";
import VisaReadinessCard from "./VisaReadinessCard";
import VisaDocumentsPanel from "./VisaDocumentsPanel";

/**
 * Admin Visa workspace. Opens without leaving the queue (a right-hand sheet on
 * desktop, full-height on mobile). Every mutation goes through `VisaService`;
 * this component owns only interaction + local UI state.
 *
 * It never touches `cases.status` — the case stays `enrollment_paid` for the
 * whole post-enrollment visa process.
 */
export default function VisaDetailSheet({
  row,
  open,
  onOpenChange,
  onChanged,
}: {
  row: VisaQueueRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();

  const { detail, loading, error, refresh } = useVisaDetail(
    row?.case_id ?? null,
    row?.student_user_id ?? null,
    { onDocumentChange: onChanged },
  );

  const [busy, setBusy] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [savingValues, setSavingValues] = useState(false);
  const [notes, setNotes] = useState("");
  const [arrivalDialog, setArrivalDialog] = useState(false);
  const [arrivalDraft, setArrivalDraft] = useState("");
  const notesInit = useRef<string | null>(null);

  useEffect(() => {
    if (detail?.application) {
      const current = detail.application.visa_notes ?? "";
      if (notesInit.current !== detail.application.id) {
        notesInit.current = detail.application.id;
        setNotes(current);
      }
    }
  }, [detail?.application]);

  const selectedIds = useMemo(
    () => new Set(detail?.selectedDocumentIds ?? []),
    [detail?.selectedDocumentIds],
  );

  const statusField = useMemo(
    () => detail?.fields.find((f) => f.field_key === "visa_status") ?? null,
    [detail?.fields],
  );
  // Prefer the just-loaded detail (authoritative for this open file) and fall
  // back to the queue row so the control is never blank while loading.
  const currentStatus: VisaStatus = normalizeVisaStatus(
    (statusField && detail?.values[statusField.id]) || row?.visa_status,
  );

  const applicationSubmitted = !!detail?.application?.visa_applied_at;

  const fail = (e: unknown, fallback: string) =>
    toast({
      variant: "destructive",
      description: `${fallback}: ${visaErrMsg(e)}`,
    });

  /** Single lazy-creation path: returns a usable application id or null. */
  const requireApplication = async (): Promise<string | null> => {
    if (!row?.student_user_id) return null;
    if (detail?.application?.id) return detail.application.id;
    const id = await ensureVisaApplication(
      row.case_id,
      row.student_user_id,
      user?.id ?? null,
      row.actual_arrival,
    );
    return id;
  };

  const handleMarkArrived = async () => {
    if (!row?.student_user_id) return;
    setBusy(true);
    try {
      await markStudentArrived(
        row.case_id,
        row.student_user_id,
        user?.id ?? null,
      );
      toast({ description: t("admin.visa.arrivedToast", "Arrival recorded.") });
      await refresh();
      onChanged();
    } catch (e) {
      fail(e, t("admin.visa.errArrival", "Failed to record arrival"));
    } finally {
      setBusy(false);
    }
  };

  const openArrivalDialog = () => {
    const current =
      detail?.application?.arrived_in_germany_at ?? row?.actual_arrival ?? null;
    setArrivalDraft(
      current ? new Date(current).toISOString().slice(0, 16) : "",
    );
    setArrivalDialog(true);
  };

  const saveArrival = async () => {
    setBusy(true);
    try {
      const appId = await requireApplication();
      const iso = arrivalDraft ? new Date(arrivalDraft).toISOString() : null;
      if (appId) await updateActualArrival(appId, iso);
      toast({
        description: t("admin.visa.arrivalSaved", "Actual arrival saved."),
      });
      setArrivalDialog(false);
      await refresh();
      onChanged();
    } catch (e) {
      fail(e, t("admin.visa.errArrival", "Failed to record arrival"));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (next: VisaStatus) => {
    if (!row?.student_user_id) return;
    if (!statusField) {
      fail(
        new Error("visa_status field missing"),
        t("admin.visa.errStatus", "Failed to update status"),
      );
      return;
    }
    setBusy(true);
    try {
      const applicationId = await requireApplication();
      const snapshot =
        next === "applied"
          ? {
              captured_at: new Date().toISOString(),
              captured_by: user?.id ?? null,
              fields: Object.fromEntries(
                (detail?.fields ?? []).map((f) => [
                  f.field_key,
                  detail?.values[f.id] ?? "",
                ]),
              ),
              profile: {
                eye_color: profile?.eye_color ?? null,
                passport_expiry: profile?.passport_expiry ?? null,
                nationality: profile?.nationality ?? null,
                has_changed_legal_name: profile?.has_changed_legal_name ?? null,
                previous_legal_name: profile?.previous_legal_name ?? null,
                has_criminal_record: profile?.has_criminal_record ?? null,
                criminal_record_details: profile?.criminal_record_details ?? null,
                has_dual_citizenship: profile?.has_dual_citizenship ?? null,
                second_passport_country: profile?.second_passport_country ?? null,
              },
              documents: detail?.selectedDocumentIds ?? [],
            }
          : undefined;

      await setVisaStatus({
        caseId: row.case_id,
        studentUserId: row.student_user_id,
        fieldId: statusField.id,
        valueId: detail?.documentIds[statusField.id],
        previousStatus: currentStatus,
        newStatus: next,
        applicationId,
        actorId: user?.id ?? null,
        snapshot,
      });
      toast({
        description: t("admin.visa.statusSaved", "Visa status updated."),
      });
      await refresh();
      onChanged();
    } catch (e) {
      fail(e, t("admin.visa.errStatus", "Failed to update status"));
    } finally {
      setBusy(false);
    }
  };

  const saveValues = async (next: Record<string, string>) => {
    if (!row?.student_user_id) return;
    setSavingValues(true);
    try {
      const updates = (detail?.fields ?? [])
        .filter((f) => f.field_key !== "visa_status")
        .filter((f) => (next[f.id] ?? "") !== (detail?.values[f.id] ?? ""))
        .map((f) => ({
          fieldId: f.id,
          value: next[f.id] ?? "",
          valueId: detail?.documentIds[f.id],
        }));
      if (updates.length > 0) {
        await saveVisaFieldValues({
          studentUserId: row.student_user_id,
          updates,
        });
      }
      toast({ description: t("common.saved", "Saved") });
      await refresh();
    } catch (e) {
      fail(e, t("common.error", "Something went wrong"));
    } finally {
      setSavingValues(false);
    }
  };

  const toggleDocument = async (doc: VisaDocument, selected: boolean) => {
    if (!row) return;
    setBusyDocId(doc.id);
    try {
      const applicationId = await requireApplication();
      if (applicationId) {
        if (selected) {
          await attachVisaDocument({
            applicationId,
            documentId: doc.id,
            actorId: user?.id ?? null,
            caseId: row.case_id,
            documentName: doc.file_name,
            category: doc.category,
          });
        } else {
          await detachVisaDocument({
            applicationId,
            documentId: doc.id,
            caseId: row.case_id,
            documentName: doc.file_name,
            category: doc.category,
          });
        }
      }
      await refresh();
      onChanged();
    } catch (e) {
      fail(e, t("admin.visa.errDocument", "Failed to update documents"));
    } finally {
      setBusyDocId(null);
    }
  };

  const previewDocument = async (doc: VisaDocument) => {
    try {
      const url = await createVisaDocumentUrl(doc.file_url, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      fail(e, t("admin.visa.errPreview", "Preview failed"));
    }
  };

  const saveNotesAction = async () => {
    setBusy(true);
    try {
      const id = await requireApplication();
      if (!id) return;
      await saveVisaNotes(id, notes);
      toast({ description: t("common.saved", "Saved") });
      await refresh();
    } catch (e) {
      fail(e, t("common.error", "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  const startFile = async () => {
    setBusy(true);
    try {
      const id = await requireApplication();
      if (!id) return;
      toast({ description: t("admin.visa.fileStarted", "Visa file started.") });
      await refresh();
      onChanged();
    } catch (e) {
      fail(e, t("common.error", "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  const profile = detail?.profile;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="space-y-1 text-start">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {row?.full_name ||
              row?.case_reference ||
              t("admin.visa.title", "Visa")}
            {row && <VisaStatusBadge status={row.visa_status} />}
          </SheetTitle>
          <SheetDescription>
            {row?.case_reference ? (
              <span className="font-mono">{row.case_reference}</span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading && !detail ? (
            <LoadingState variant="rows" rows={4} />
          ) : error && !detail ? (
            <ErrorState
              title={t("common.error", "Something went wrong")}
              onRetry={() => void refresh()}
            />
          ) : (
            <>
              {!detail?.application && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "admin.visa.noFileYet",
                      "No visa file exists for this student yet.",
                    )}
                  </p>
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={busy}
                    onClick={() => void startFile()}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Globe className="h-3.5 w-3.5" />
                    )}
                    {t("admin.visa.startFile", "Start Visa File")}
                  </Button>
                </div>
              )}
              <SectionCard
                title={t("admin.visa.student", "Student")}
                icon={GraduationCap}
                description={profile?.university_name ?? undefined}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {row?.phone && (
                      <span className="flex items-center gap-1" dir="ltr">
                        <Phone className="h-3.5 w-3.5" />
                        {row.phone}
                      </span>
                    )}
                    {row?.email && (
                      <span className="flex items-center gap-1" dir="ltr">
                        <Mail className="h-3.5 w-3.5" />
                        {row.email}
                      </span>
                    )}
                    {row?.assigned_name && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />
                        {row.assigned_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-0 bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]"
                    >
                      {t("admin.visa.enrolled", "Enrolled")}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        row?.actual_arrival
                          ? "border-0 bg-[hsl(var(--status-paid)/0.14)] text-[hsl(var(--status-paid))]"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {row?.actual_arrival
                        ? t("admin.visa.arrived", "Arrived")
                        : t("admin.visa.notArrived", "Not arrived")}
                    </Badge>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t("admin.visa.arrival", "Arrival")}
                icon={Globe}
              >
                <div className="space-y-3">
                  <VisaArrivalPanel
                    plannedArrival={row?.planned_arrival ?? null}
                    actualArrival={
                      detail?.application?.arrived_in_germany_at ??
                      row?.actual_arrival ??
                      null
                    }
                    canEdit={!!row?.student_user_id}
                    onEditActual={openArrivalDialog}
                  />
                  {!row?.actual_arrival && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      disabled={busy}
                      onClick={handleMarkArrived}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plane className="h-3.5 w-3.5" />
                      )}
                      {t("admin.visa.markArrived", "Mark as Arrived")}
                    </Button>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title={t("admin.visa.statusLabel", "Visa status")}
                icon={CheckCircle2}
              >
                <div className="space-y-3">
                  {detail?.application?.submission_snapshot && (
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        "admin.visa.snapshotCaptured",
                        "A submission snapshot was captured for audit when this application was marked applied.",
                      )}
                    </p>
                  )}
                  {applicationSubmitted ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={currentStatus}
                        onValueChange={(v) => void changeStatus(v as VisaStatus)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-9 w-[200px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VISA_STATUSES.filter((s) => s !== "not_applied").map((s) => (
                            <SelectItem key={s} value={s}>
                              {t(`admin.visa.status.${s}`, s.replace(/_/g, " "))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "admin.visa.waitingStudentSubmission",
                        "Waiting for the student to submit this Visa file. Administration cannot mark it applied from here.",
                      )}
                    </p>
                  )}
                  {detail?.application?.visa_applied_at && (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.visa.appliedAt", "Applied")}:{" "}
                      {new Date(
                        detail.application.visa_applied_at,
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              </SectionCard>

              <VisaReadinessCard
                fields={detail?.fields ?? []}
                values={detail?.values ?? {}}
                documents={detail?.documents ?? []}
                selectedDocumentIds={selectedIds}
              />

              <VisaInformationPanel
                fields={detail?.fields ?? []}
                values={detail?.values ?? {}}
                profile={profile}
                saving={savingValues}
                canEdit
                onSaveValues={saveValues}
              />

              <VisaDocumentsPanel
                documents={detail?.documents ?? []}
                selectedIds={selectedIds}
                application={detail?.application ?? null}
                busyId={busyDocId}
                onToggleSelect={toggleDocument}
                onPreview={previewDocument}
                onDownload={(doc) =>
                  downloadVisaDocument(doc.file_url, doc.file_name).catch((e) =>
                    fail(e, t("admin.visa.errDownload", "Download failed")),
                  )
                }
              />

              <SectionCard
                title={t("admin.visa.notes", "Internal Visa Notes")}
                icon={StickyNote}
              >
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "admin.visa.notesHint",
                      "Internal only — missing information, authority communication, appointment and follow-up notes.",
                    )}
                  </p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="text-sm"
                    placeholder={t(
                      "admin.visa.notesPlaceholder",
                      "Add an internal note…",
                    )}
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={busy}
                    onClick={() => void saveNotesAction()}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t("common.save", "Save")}
                  </Button>
                </div>
              </SectionCard>

              <Separator />
            </>
          )}
        </div>

        <AlertDialog open={arrivalDialog} onOpenChange={setArrivalDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("admin.visa.editArrival", "Edit actual arrival")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "admin.visa.editArrivalHint",
                  "This records when the student actually arrived. The planned arrival date is not changed.",
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">
                {t("admin.visa.actualArrival", "Actual arrival")}
              </Label>
              <Input
                type="datetime-local"
                value={arrivalDraft}
                onChange={(e) => setArrivalDraft(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t("common.cancel", "Cancel")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void saveArrival()}>
                {t("common.save", "Save")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
