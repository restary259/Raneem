import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Globe, Edit, Save, X, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

interface VisaField {
  id: string;
  field_key: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: any[] | null;
  display_order: number;
}

const VISA_STATUS_COLORS: Record<string, string> = {
  not_applied: "bg-muted text-muted-foreground",
  applied: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  received: "bg-emerald-100 text-emerald-800",
};

const eyeColorOptions = ["brown", "blue", "green", "hazel", "gray", "other"];

export default function StudentVisaPage() {
  const [userId, setUserId] = useState<string | null>(null);

  // Dynamic visa fields from admin settings
  const [fields, setFields] = useState<VisaField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({}); // field_id → value
  const [valueIds, setValueIds] = useState<Record<string, string>>({}); // field_id → row.id (for upsert)
  const [editingDynamic, setEditingDynamic] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  // Legal / personal fields from profile
  const [profile, setProfile] = useState<any>(null);
  const [editingLegal, setEditingLegal] = useState(false);
  const [legalDraft, setLegalDraft] = useState<any>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    try {
      const [fieldsRes, valuesRes, profileRes] = await Promise.all([
        (supabase as any)
          .from("visa_fields")
          .select("id, field_key, label_en, label_ar, field_type, options_json, display_order")
          .eq("is_active", true)
          .order("display_order"),
        (supabase as any).from("visa_field_values").select("id, field_id, value").eq("student_user_id", uid),
        (supabase as any)
          .from("profiles")
          .select(
            "eye_color, has_changed_legal_name, previous_legal_name, has_criminal_record, criminal_record_details, has_dual_citizenship, second_passport_country",
          )
          .eq("id", uid)
          .maybeSingle(),
      ]);

      if (fieldsRes.data) setFields(fieldsRes.data);

      const valMap: Record<string, string> = {};
      const idMap: Record<string, string> = {};
      (valuesRes.data ?? []).forEach((v: any) => {
        valMap[v.field_id] = v.value ?? "";
        idMap[v.field_id] = v.id;
      });
      setValues(valMap);
      setValueIds(idMap);
      setDraftValues(valMap);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setLegalDraft(profileRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/student-auth");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  // ── Save dynamic visa fields ──
  const saveDynamic = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const upserts = fields.map((f) => ({
        id: valueIds[f.id] ?? undefined,
        field_id: f.id,
        student_user_id: userId,
        value: draftValues[f.id] ?? null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any)
        .from("visa_field_values")
        .upsert(upserts, { onConflict: "field_id,student_user_id" });
      if (error) throw error;
      setValues(draftValues);
      setEditingDynamic(false);
      toast({ description: isAr ? "تم الحفظ" : "Saved" });
      load(userId);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Save legal fields to profile ──
  const saveLegal = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          eye_color: legalDraft.eye_color,
          has_changed_legal_name: legalDraft.has_changed_legal_name,
          previous_legal_name: legalDraft.has_changed_legal_name ? legalDraft.previous_legal_name : null,
          has_criminal_record: legalDraft.has_criminal_record,
          criminal_record_details: legalDraft.has_criminal_record ? legalDraft.criminal_record_details : null,
          has_dual_citizenship: legalDraft.has_dual_citizenship,
          second_passport_country: legalDraft.has_dual_citizenship ? legalDraft.second_passport_country : null,
        })
        .eq("id", userId);
      if (error) throw error;
      setProfile(legalDraft);
      setEditingLegal(false);
      toast({ description: isAr ? "تم الحفظ" : "Saved" });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Visa status (from visa_fields with key=visa_status) ──
  const visaStatusField = fields.find((f) => f.field_key === "visa_status");
  const visaStatusValue = visaStatusField ? (values[visaStatusField.id] ?? null) : null;
  const visaStatusColorClass = VISA_STATUS_COLORS[visaStatusValue ?? "not_applied"] || VISA_STATUS_COLORS.not_applied;

  // Fields excluding visa_status (those are admin-set only)
  const editableFields = fields.filter((f) => f.field_key !== "visa_status");

  const renderInput = (field: VisaField, val: string, onChange: (v: string) => void, disabled: boolean) => {
    const label = isAr ? field.label_ar : field.label_en;
    switch (field.field_type) {
      case "boolean":
        return (
          <div key={field.id} className="flex items-center justify-between py-2">
            <Label className="text-sm">{label}</Label>
            <Switch
              checked={val === "true"}
              onCheckedChange={(v) => onChange(v ? "true" : "false")}
              disabled={disabled}
            />
          </div>
        );
      case "select":
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Select value={val || ""} onValueChange={onChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(field.options_json ?? []).map((o: any) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isAr ? o.ar : o.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "date":
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input type="date" value={val || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
          </div>
        );
      case "textarea":
        return (
          <div key={field.id} className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Textarea value={val || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} />
          </div>
        );
      default:
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <Input value={val || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="—" />
          </div>
        );
    }
  };

  if (!userId || loading) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* ── Status header ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {t("visa.title", "Visa Application")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visaStatusValue ? (
            <Badge className={`${visaStatusColorClass} border-0 text-sm px-3 py-1`}>{visaStatusValue}</Badge>
          ) : (
            <Badge variant="secondary">{isAr ? "لم يُقدَّم بعد" : "Not Applied Yet"}</Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {t("visa.readOnly", "Visa status is managed by your team member.")}
          </p>
        </CardContent>
      </Card>

      {/* ── Dynamic visa fields (editable by student) ── */}
      {editableFields.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t("visa.personalInfo", "Visa Information")}</CardTitle>
            {!editingDynamic ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftValues({ ...values });
                  setEditingDynamic(true);
                }}
              >
                <Edit className="h-4 w-4 me-1" /> {t("profile.edit", "Edit")}
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
                  disabled={saving}
                >
                  <X className="h-4 w-4 me-1" /> {t("profile.cancel", "Cancel")}
                </Button>
                <Button size="sm" onClick={saveDynamic} disabled={saving}>
                  <Save className="h-4 w-4 me-1" /> {t("profile.save", "Save")}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editableFields.map((field) =>
                renderInput(
                  field,
                  editingDynamic ? (draftValues[field.id] ?? "") : (values[field.id] ?? ""),
                  (v) => setDraftValues((d) => ({ ...d, [field.id]: v })),
                  !editingDynamic,
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Legal / Personal Information (moved from profile page) ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{t("profile.legalSection", "Legal Information")}</CardTitle>
          </div>
          {!editingLegal ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLegalDraft({ ...profile });
                setEditingLegal(true);
              }}
            >
              <Edit className="h-4 w-4 me-1" /> {t("profile.edit", "Edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLegalDraft({ ...profile });
                  setEditingLegal(false);
                }}
                disabled={saving}
              >
                <X className="h-4 w-4 me-1" /> {t("profile.cancel", "Cancel")}
              </Button>
              <Button size="sm" onClick={saveLegal} disabled={saving}>
                <Save className="h-4 w-4 me-1" /> {t("profile.save", "Save")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Eye color */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("profile.eyeColor", "Eye Color")}</Label>
            <Select
              value={editingLegal ? legalDraft.eye_color || "" : profile?.eye_color || ""}
              onValueChange={(v) => setLegalDraft((d: any) => ({ ...d, eye_color: v }))}
              disabled={!editingLegal}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {eyeColorOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Changed legal name */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">
              {t("profile.hasChangedLegalName", "Have you ever changed your legal name?")}
            </Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_changed_legal_name : !!profile?.has_changed_legal_name}
              onCheckedChange={(v) => setLegalDraft((d: any) => ({ ...d, has_changed_legal_name: v }))}
              disabled={!editingLegal}
            />
          </div>
          {(editingLegal ? legalDraft.has_changed_legal_name : profile?.has_changed_legal_name) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("profile.previousLegalName", "Previous Legal Name")}
              </Label>
              <Input
                value={editingLegal ? legalDraft.previous_legal_name || "" : profile?.previous_legal_name || ""}
                onChange={(e) => setLegalDraft((d: any) => ({ ...d, previous_legal_name: e.target.value }))}
                disabled={!editingLegal}
              />
            </div>
          )}

          {/* Criminal record */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">{t("profile.hasCriminalRecord", "Do you have a criminal record?")}</Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_criminal_record : !!profile?.has_criminal_record}
              onCheckedChange={(v) => setLegalDraft((d: any) => ({ ...d, has_criminal_record: v }))}
              disabled={!editingLegal}
            />
          </div>
          {(editingLegal ? legalDraft.has_criminal_record : profile?.has_criminal_record) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("profile.criminalRecordDetails", "Details")}</Label>
              <Textarea
                value={editingLegal ? legalDraft.criminal_record_details || "" : profile?.criminal_record_details || ""}
                onChange={(e) => setLegalDraft((d: any) => ({ ...d, criminal_record_details: e.target.value }))}
                disabled={!editingLegal}
                rows={2}
              />
            </div>
          )}

          {/* Dual citizenship */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">{t("profile.hasDualCitizenship", "Do you have dual citizenship?")}</Label>
            <Switch
              checked={editingLegal ? !!legalDraft.has_dual_citizenship : !!profile?.has_dual_citizenship}
              onCheckedChange={(v) => setLegalDraft((d: any) => ({ ...d, has_dual_citizenship: v }))}
              disabled={!editingLegal}
            />
          </div>
          {(editingLegal ? legalDraft.has_dual_citizenship : profile?.has_dual_citizenship) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("profile.secondPassportCountry", "Second Passport Country")}
              </Label>
              <Input
                value={editingLegal ? legalDraft.second_passport_country || "" : profile?.second_passport_country || ""}
                onChange={(e) => setLegalDraft((d: any) => ({ ...d, second_passport_country: e.target.value }))}
                disabled={!editingLegal}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
