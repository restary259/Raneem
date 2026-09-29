import React, { useCallback, useState } from "react";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Edit,
  FileCheck2,
  FileText,
  Globe,
  Loader2,
  Plane,
  Save,
  Shield,
  Upload,
  X,
} from "lucide-react";
import {
  attachVisaDocument,
  detachVisaDocument,
  downloadVisaDocument,
  ensureStudentVisaApplication,
  markOwnVisaArrived,
  submitStudentVisaApplication,
  visaErrMsg,
} from "@/services/VisaService";
import { missingRequiredVisaFields } from "@/lib/visaStatus";
import { toneClasses } from "@/lib/statusTokens";

interface VisaField {
  id: string;
  field_key: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: Array<{ value: string; en?: string; ar?: string }> | null;
  is_required: boolean;
  display_order: number;
}

interface VisaApplication {
  id: string;
  case_id: string;
  student_user_id: string;
  arrived_in_germany_at: string | null;
  visa_applied_at: string | null;
  visa_outcome: string | null;
}

interface StudentDocument {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

const eyeColorOptions = ["brown", "blue", "green", "hazel", "gray", "other"];

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export default function StudentVisaPage() {
  const [fields, setFields] = useState<VisaField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [valueIds, setValueIds] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [caseRow, setCaseRow] = useState<any | null>(null);
  const [application, setApplication] = useState<VisaApplication | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  const [editingDynamic, setEditingDynamic] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [editingLegal, setEditingLegal] = useState(false);
  const [legalDraft, setLegalDraft] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: ownCases, error: caseError } = await (supabase as any).rpc("get_my_case");
      if (caseError) throw caseError;

      const ownCase = Array.isArray(ownCases) ? ownCases[0] : null;
      setCaseRow(ownCase);

      if (!ownCase?.id || ownCase.status !== "enrollment_paid") {
        setApplication(null);
        setFields([]);
        setValues({});
        setDocuments([]);
        setSelectedDocumentIds([]);
        return;
      }

      let currentApplication: VisaApplication | null = null;
      const { data: existingApplication, error: applicationError } = await (supabase as any)
        .from("visa_applications")
        .select("id, case_id, student_user_id, arrived_in_germany_at, visa_applied_at, visa_outcome")
        .eq("case_id", ownCase.id)
        .maybeSingle();
      if (applicationError && applicationError.code !== "PGRST116") throw applicationError;
      currentApplication = existingApplication as VisaApplication | null;

      if (!currentApplication) {
        const applicationId = await ensureStudentVisaApplication(ownCase.id);
        const { data: createdApplication, error: createdError } = await (supabase as any)
          .from("visa_applications")
          .select("id, case_id, student_user_id, arrived_in_germany_at, visa_applied_at, visa_outcome")
          .eq("id", applicationId)
          .single();
        if (createdError) throw createdError;
        currentApplication = createdApplication as VisaApplication;
      }

      const [fieldsRes, valuesRes, profileRes, docsRes, linksRes] = await Promise.all([
        (supabase as any)
          .from("visa_fields")
          .select("id, field_key, label_en, label_ar, field_type, options_json, is_required, display_order")
          .eq("is_active", true)
          .order("display_order"),
        (supabase as any)
          .from("visa_field_values")
          .select("id, field_id, value")
          .eq("student_user_id", uid),
        (supabase as any)
          .from("profiles")
          .select(
            "eye_color, passport_expiry, arrival_date, has_changed_legal_name, previous_legal_name, has_criminal_record, criminal_record_details, has_dual_citizenship, second_passport_country",
          )
          .eq("id", uid)
          .maybeSingle(),
        (supabase as any)
          .from("documents")
          .select("id, file_name, file_url, category, file_size, file_type, created_at")
          .eq("student_id", uid)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("visa_application_documents")
          .select("document_id")
          .eq("visa_application_id", currentApplication.id),
      ]);

      if (fieldsRes.error) throw fieldsRes.error;
      if (valuesRes.error) throw valuesRes.error;
      if (profileRes.error) throw profileRes.error;
      if (docsRes.error) throw docsRes.error;
      if (linksRes.error) throw linksRes.error;

      const fieldRows = (fieldsRes.data ?? []) as VisaField[];
      const valueMap: Record<string, string> = {};
      const valueIdMap: Record<string, string> = {};
      (valuesRes.data ?? []).forEach((v: any) => {
        valueMap[v.field_id] = v.value ?? "";
        valueIdMap[v.field_id] = v.id;
      });

      setApplication(currentApplication);
      setFields(fieldRows);
      setValues(valueMap);
      setValueIds(valueIdMap);
      setDraftValues(valueMap);
      setProfile(profileRes.data ?? null);
      setLegalDraft(profileRes.data ?? {});
      setDocuments((docsRes.data ?? []) as StudentDocument[]);
      setSelectedDocumentIds((linksRes.data ?? []).map((row: any) => row.document_id));
    } catch (err) {
      const message = visaErrMsg(err);
      setLoadError(message);
      toast({
        variant: "destructive",
        description: t("visa.loadError", "Could not load your Visa file") + ": " + message,
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const userId = useAuthedUserId(load);

  useRealtimeSubscription("cases", () => {
    if (userId) void load(userId);
  }, !!userId);
  useRealtimeSubscription("documents", () => {
    if (userId) void load(userId);
  }, !!userId);

  const saveDynamic = async () => {
    if (!userId || !application || application.visa_applied_at) return;
    setBusy(true);
    try {
      const upserts = fields
        .filter((field) => field.field_key !== "visa_status")
        .map((field) => ({
          id: valueIds[field.id] ?? undefined,
          field_id: field.id,
          student_user_id: userId,
          value: draftValues[field.id] ?? null,
          updated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error } = await (supabase as any)
          .from("visa_field_values")
          .upsert(upserts, { onConflict: "field_id,student_user_id" });
        if (error) throw error;
      }

      setValues(draftValues);
      setEditingDynamic(false);
      toast({ description: t("visa.saveSuccess", "Saved") });
      await load(userId);
    } catch (err) {
      toast({ variant: "destructive", description: visaErrMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const saveLegal = async () => {
    if (!userId || !application || application.visa_applied_at) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          eye_color: legalDraft.eye_color || null,
          passport_expiry: legalDraft.passport_expiry || null,
          arrival_date: legalDraft.arrival_date || null,
          has_changed_legal_name: !!legalDraft.has_changed_legal_name,
          previous_legal_name: legalDraft.has_changed_legal_name ? legalDraft.previous_legal_name || null : null,
          has_criminal_record: !!legalDraft.has_criminal_record,
          criminal_record_details: legalDraft.has_criminal_record
            ? legalDraft.criminal_record_details || null
            : null,
          has_dual_citizenship: !!legalDraft.has_dual_citizenship,
          second_passport_country: legalDraft.has_dual_citizenship
            ? legalDraft.second_passport_country || null
            : null,
        })
        .eq("id", userId);
      if (error) throw error;
      setProfile(legalDraft);
      setEditingLegal(false);
      toast({ description: t("visa.saveSuccess", "Saved") });
      await load(userId);
    } catch (err) {
      toast({ variant: "destructive", description: visaErrMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const markArrived = async () => {
    if (!userId || !caseRow?.id || !application || application.visa_applied_at) return;
    setBusy(true);
    try {
      await markOwnVisaArrived(caseRow.id);
      toast({ description: t("visa.arrivalSaved", "Arrival recorded.") });
      await load(userId);
    } catch (err) {
      toast({ variant: "destructive", description: visaErrMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const toggleDocument = async (doc: StudentDocument, selected: boolean) => {
    if (!userId || !caseRow?.id || !application || application.visa_applied_at) return;
    setDocumentBusyId(doc.id);
    try {
      if (selected) {
        await attachVisaDocument({
          applicationId: application.id,
          documentId: doc.id,
          actorId: userId,
          caseId: caseRow.id,
          documentName: doc.file_name,
          category: doc.category,
        });
        setSelectedDocumentIds((current) =>
          current.includes(doc.id) ? current : [...current, doc.id],
        );
      } else {
        await detachVisaDocument({
          applicationId: application.id,
          documentId: doc.id,
          caseId: caseRow.id,
          documentName: doc.file_name,
          category: doc.category,
        });
        setSelectedDocumentIds((current) => current.filter((id) => id !== doc.id));
      }
    } catch (err) {
      toast({
        variant: "destructive",
        description: t("visa.documentActionError", "Could not update the Visa file") + ": " + visaErrMsg(err),
      });
    } finally {
      setDocumentBusyId(null);
    }
  };

  const downloadDocument = async (doc: StudentDocument) => {
    try {
      await downloadVisaDocument(doc.file_url, doc.file_name);
    } catch (err) {
      toast({ variant: "destructive", description: visaErrMsg(err) });
    }
  };

  const submit = async () => {
    if (!userId || !caseRow?.id || !application || application.visa_applied_at) return;

    const missingFields = missingRequiredVisaFields(fields, values);
    if (missingFields.length > 0) {
      toast({
        variant: "destructive",
        description: t(
          "visa.completeInformation",
          "Complete the required configured Visa information before submitting.",
        ),
      });
      setEditingDynamic(true);
      return;
    }

    if (!application.arrived_in_germany_at) {
      toast({
        variant: "destructive",
        description: t(
          "visa.arrivalRequired",
          "Confirm your arrival in Germany before submitting the Visa file.",
        ),
      });
      return;
    }

    setBusy(true);
    try {
      await submitStudentVisaApplication(caseRow.id);
      toast({
        title: t("visa.submitted", "Submitted for Administration"),
        description: t(
          "visa.submittedSuccess",
          "Your Visa file was submitted to Administration.",
        ),
      });
      await load(userId);
    } catch (err) {
      toast({ variant: "destructive", description: visaErrMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  const visaStatusField = fields.find((field) => field.field_key === "visa_status");
  const visaStatusValue =
    (visaStatusField ? values[visaStatusField.id] : null) ??
    (application?.visa_applied_at ? "applied" : "not_applied");
  const submitted = !!application?.visa_applied_at;

  const editableFields = fields.filter((field) => field.field_key !== "visa_status");
  const missingRequired = missingRequiredVisaFields(fields, values);

  const renderInput = (
    field: VisaField,
    value: string,
    onChange: (nextValue: string) => void,
    disabled: boolean,
  ) => {
    const label = isAr ? field.label_ar : field.label_en;
    switch (field.field_type) {
      case "boolean":
        return (
          <div key={field.id} className="flex items-center justify-between gap-4 py-2">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={value === "true"}
              onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
              disabled={disabled}
            />
          </div>
        );
      case "select":
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {label}
              {field.is_required ? " *" : ""}
            </Label>
            <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(field.options_json ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {isAr ? option.ar || option.en || option.value : option.en || option.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "date":
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {label}
              {field.is_required ? " *" : ""}
            </Label>
            <Input
              type="date"
              value={value || ""}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
            />
          </div>
        );
      case "textarea":
        return (
          <div key={field.id} className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">
              {label}
              {field.is_required ? " *" : ""}
            </Label>
            <Textarea
              value={value || ""}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              rows={3}
            />
          </div>
        );
      default:
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {label}
              {field.is_required ? " *" : ""}
            </Label>
            <Input
              value={value || ""}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              placeholder="—"
            />
          </div>
        );
    }
  };

  if (!userId || loading) return <DashboardLoading />;

  if (!caseRow?.id || caseRow.status !== "enrollment_paid") {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              {t("visa.title", "Visa Application")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="secondary">
              {t("visa.availableAfterEnrollment", "Available after enrollment")}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {t(
                "visa.enrollmentRequired",
                "Your Visa workflow becomes available after your enrollment is confirmed.",
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError && !application) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t("visa.loadError", "Could not load your Visa file")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button onClick={() => void load(userId)}>{t("common.retry", "Retry")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {t("visa.title", "Visa Application")}
            {submitted ? (
              <Badge className={toneClasses("submitted").chip}>
                <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                {t("visa.submitted", "Submitted for Administration")}
              </Badge>
            ) : (
              <Badge variant="secondary">
                {t("visa.prepare", "Preparation")}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {submitted
              ? t("visa.submittedBody", "Your Visa file is with Administration. Your case remains enrolled.")
              : t(
                  "visa.availableAfterEnrollment",
                  "Your enrollment is complete. Complete the Visa file after you have arrived in Germany.",
                )}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("visa.status", "Status")}</p>
              <p className="mt-1 text-sm font-semibold">{visaStatusValue}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("visa.arrivalDate", "Actual arrival")}</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(application?.arrived_in_germany_at)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t("visa.submittedAt", "Submitted")}</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(application?.visa_applied_at)}</p>
            </div>
          </div>

          {!submitted && !application?.arrived_in_germany_at && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Plane className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">
                    {t("visa.postArrivalTitle", "Start your post-arrival Visa preparation")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "visa.postArrivalBody",
                      "Confirm that you have arrived in Germany after completing your arrival and registration steps.",
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={markArrived} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plane className="h-4 w-4 me-1" />}
                {t("visa.markArrived", "I've arrived in Germany")}
              </Button>
            </div>
          )}

          {application?.arrived_in_germany_at && (
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--status-enrolled)/0.28)] bg-[hsl(var(--status-enrolled)/0.08)] p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-enrolled))]" />
              <span>
                {t("visa.arrived", "Arrived in Germany")} · {formatDate(application.arrived_in_germany_at)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!submitted && editableFields.length === 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("visa.noFields", "Visa information is not configured yet")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    "visa.noFieldsBody",
                    "Administration will add the configured Visa questions later. You can still prepare your documents now.",
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editableFields.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("visa.personalInfo", "Visa Information")}</CardTitle>
            {!submitted && (!editingDynamic ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftValues({ ...values });
                  setEditingDynamic(true);
                }}
              >
                <Edit className="h-4 w-4 me-1" />
                {t("profile.edit", "Edit")}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftValues({ ...values });
                    setEditingDynamic(false);
                  }}
                  disabled={busy}
                >
                  <X className="h-4 w-4 me-1" />
                  {t("profile.cancel", "Cancel")}
                </Button>
                <Button size="sm" onClick={saveDynamic} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
                  {t("profile.save", "Save")}
                </Button>
              </div>
            ))}
          </CardHeader>
          <CardContent>
            {missingRequired.length > 0 && !submitted && (
              <p className="mb-4 text-xs text-amber-700">
                {t("visa.completeInformation", "Complete the required configured Visa information before submitting.")}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {editableFields.map((field) =>
                renderInput(
                  field,
                  editingDynamic ? draftValues[field.id] ?? "" : values[field.id] ?? "",
                  (nextValue) => setDraftValues((current) => ({ ...current, [field.id]: nextValue })),
                  submitted || !editingDynamic,
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            {t("visa.documents", "Documents")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                {selectedDocumentIds.length} {t("visa.documentsSelected", "documents selected for this Visa file")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("visa.documentsHint", "Upload documents in your Documents area, then select the ones that belong to this Visa file.")}
              </p>
            </div>
            {!submitted && (
              <Button variant="outline" size="sm" onClick={() => navigate("/student/documents")}>
                <Upload className="h-4 w-4 me-1" />
                {t("visa.manageDocuments", "Upload / manage documents")}
              </Button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <p className="text-sm font-medium">{t("visa.noDocuments", "No documents uploaded yet")}</p>
              {!submitted && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/student/documents")}
                  className="mt-1"
                >
                  {t("visa.uploadDocuments", "Upload documents")}
                  <ArrowRight className="h-3.5 w-3.5 ms-1 rtl:rotate-180" />
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {documents.map((doc) => {
                const selected = selectedDocumentIds.includes(doc.id);
                const busyDoc = documentBusyId === doc.id;
                return (
                  <div key={doc.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.category} · {formatDate(doc.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void downloadDocument(doc)}
                        disabled={busyDoc}
                      >
                        {t("visa.preview", "Open")}
                      </Button>
                      {!submitted && (
                        <Button
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() => void toggleDocument(doc, !selected)}
                          disabled={busyDoc}
                          className="gap-1"
                        >
                          {busyDoc ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : selected ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : null}
                          {selected
                            ? t("visa.removeSelection", "Remove")
                            : t("visa.selectForVisa", "Select for Visa")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("profile.legalSection", "Legal Information")}</CardTitle>
          </div>
          {!submitted && (!editingLegal ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLegalDraft({ ...(profile ?? {}) });
                setEditingLegal(true);
              }}
            >
              <Edit className="h-4 w-4 me-1" />
              {t("profile.edit", "Edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLegalDraft({ ...(profile ?? {}) });
                  setEditingLegal(false);
                }}
                disabled={busy}
              >
                <X className="h-4 w-4 me-1" />
                {t("profile.cancel", "Cancel")}
              </Button>
              <Button size="sm" onClick={saveLegal} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
                {t("profile.save", "Save")}
              </Button>
            </div>
          ))}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("profile.eyeColor", "Eye Color")}</Label>
            <Select
              value={editingLegal ? legalDraft.eye_color || "" : profile?.eye_color || ""}
              onValueChange={(value) => setLegalDraft((current) => ({ ...current, eye_color: value }))}
              disabled={submitted || !editingLegal}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {eyeColorOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("profile.passportExpiry", "Passport expiry date")}</Label>
            <Input
              type="date"
              value={editingLegal ? legalDraft.passport_expiry || "" : profile?.passport_expiry || ""}
              onChange={(event) => setLegalDraft((current) => ({ ...current, passport_expiry: event.target.value }))}
              disabled={submitted || !editingLegal}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("profile.arrivalDate", "Planned arrival date in Germany")}</Label>
            <Input
              type="date"
              value={editingLegal ? legalDraft.arrival_date || "" : profile?.arrival_date || ""}
              onChange={(event) => setLegalDraft((current) => ({ ...current, arrival_date: event.target.value }))}
              disabled={submitted || !editingLegal}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <Label className="text-sm">{t("profile.hasChangedLegalName", "Have you ever changed your legal name?")}</Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_changed_legal_name : !!profile?.has_changed_legal_name}
              onCheckedChange={(checked) => setLegalDraft((current) => ({ ...current, has_changed_legal_name: checked }))}
              disabled={submitted || !editingLegal}
            />
          </div>

          {(editingLegal ? legalDraft.has_changed_legal_name : profile?.has_changed_legal_name) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("profile.previousLegalName", "Previous Legal Name")}</Label>
              <Input
                value={editingLegal ? legalDraft.previous_legal_name || "" : profile?.previous_legal_name || ""}
                onChange={(event) => setLegalDraft((current) => ({ ...current, previous_legal_name: event.target.value }))}
                disabled={submitted || !editingLegal}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 py-1">
            <Label className="text-sm">{t("profile.hasCriminalRecord", "Do you have a criminal record?")}</Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_criminal_record : !!profile?.has_criminal_record}
              onCheckedChange={(checked) => setLegalDraft((current) => ({ ...current, has_criminal_record: checked }))}
              disabled={submitted || !editingLegal}
            />
          </div>

          {(editingLegal ? legalDraft.has_criminal_record : profile?.has_criminal_record) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("profile.criminalRecordDetails", "Details")}</Label>
              <Textarea
                value={editingLegal ? legalDraft.criminal_record_details || "" : profile?.criminal_record_details || ""}
                onChange={(event) => setLegalDraft((current) => ({ ...current, criminal_record_details: event.target.value }))}
                disabled={submitted || !editingLegal}
                rows={2}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 py-1">
            <Label className="text-sm">{t("profile.hasDualCitizenship", "Do you have dual citizenship?")}</Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_dual_citizenship : !!profile?.has_dual_citizenship}
              onCheckedChange={(checked) => setLegalDraft((current) => ({ ...current, has_dual_citizenship: checked }))}
              disabled={submitted || !editingLegal}
            />
          </div>

          {(editingLegal ? legalDraft.has_dual_citizenship : profile?.has_dual_citizenship) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("profile.secondPassportCountry", "Second Passport Country")}</Label>
              <Input
                value={editingLegal ? legalDraft.second_passport_country || "" : profile?.second_passport_country || ""}
                onChange={(event) => setLegalDraft((current) => ({ ...current, second_passport_country: event.target.value }))}
                disabled={submitted || !editingLegal}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!submitted && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{t("visa.readyToSubmit", "Review your Visa file")}</p>
                <p className="text-xs text-muted-foreground">
                  {missingRequired.length === 0
                    ? t("visa.readyToSubmitBody", "Your configured required information is complete. Make sure your selected documents are ready.")
                    : t("visa.completeInformation", "Complete the required configured Visa information before submitting.")}
                </p>
              </div>
              <Button
                onClick={() => void submit()}
                disabled={busy || !application?.arrived_in_germany_at || missingRequired.length > 0}
                className="shrink-0"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4 me-1" />}
                {t("visa.submitForAdministration", "Submit for Administration")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
