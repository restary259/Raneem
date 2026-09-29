import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { SectionCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Edit3, X, Save, Loader2, Shield } from "lucide-react";
import type { VisaField, VisaProfileInfo } from "@/services/VisaService";

const EYE_COLORS = ["brown", "blue", "green", "hazel", "gray", "other"];

/**
 * Consolidated read-only view of everything the student (and admin) already
 * entered: the dynamic `visa_fields`/`visa_field_values` plus the profile
 * immigration fields. Admin can edit field values inline; the profile
 * immigration data is displayed (it is edited on the existing students/visa
 * surfaces, not duplicated here).
 *
 * The `visa_status` field is intentionally excluded — it is managed by the
 * dedicated status control so there is only ONE status surface.
 */
export default function VisaInformationPanel({
  fields,
  values,
  profile,
  saving,
  canEdit,
  onSaveValues,
}: {
  fields: VisaField[];
  values: Record<string, string>;
  profile: VisaProfileInfo | null | undefined;
  saving: boolean;
  canEdit: boolean;
  onSaveValues: (next: Record<string, string>) => Promise<void>;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);

  useEffect(() => {
    if (!editing) setDraft(values);
  }, [values, editing]);

  const editableFields = fields.filter((f) => f.field_key !== "visa_status");

  const renderValue = (field: VisaField, val: string) => {
    if (field.field_type === "boolean") {
      return (
        <Badge
          variant="outline"
          className={
            val === "true"
              ? "border-0 bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]"
              : "border-border text-muted-foreground"
          }
        >
          {val === "true" ? t("common.yes", "Yes") : t("common.no", "No")}
        </Badge>
      );
    }
    if (field.field_type === "date" && val) {
      try {
        return (
          <span className="font-medium text-foreground">
            {format(new Date(val), "PPP")}
          </span>
        );
      } catch {
        return <span className="font-medium text-foreground">{val}</span>;
      }
    }
    return <span className="font-medium text-foreground">{val || "—"}</span>;
  };

  const renderInput = (field: VisaField) => {
    const label = isAr ? field.label_ar : field.label_en;
    const val = draft[field.id] ?? "";
    const onChange = (v: string) => setDraft((d) => ({ ...d, [field.id]: v }));

    if (field.field_type === "boolean") {
      return (
        <div
          key={field.id}
          className="flex items-center justify-between py-1 text-xs"
        >
          <span className="text-muted-foreground">{label}</span>
          <Switch
            checked={val === "true"}
            onCheckedChange={(v) => onChange(v ? "true" : "false")}
          />
        </div>
      );
    }
    if (field.field_type === "select") {
      return (
        <div key={field.id} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
          <Select value={val || ""} onValueChange={onChange}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {(field.options_json ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {isAr ? o.ar || o.value : o.en || o.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div key={field.id} className="flex items-center gap-2 text-xs">
        <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
        <Input
          type={field.field_type === "date" ? "date" : "text"}
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 flex-1 text-xs"
        />
      </div>
    );
  };

  const profileRows: Array<{ label: string; value: string }> = profile
    ? [
        {
          label: t("visa.eyeColor", "Eye color"),
          value: profile.eye_color || "—",
        },
        {
          label: t("visa.passportExpiry", "Passport expiry"),
          value: profile.passport_expiry || "—",
        },
        {
          label: t("visa.nationality", "Nationality"),
          value: profile.nationality || "—",
        },
        {
          label: t("profile.hasChangedLegalName", "Changed legal name"),
          value: profile.has_changed_legal_name
            ? profile.previous_legal_name || t("common.yes", "Yes")
            : t("common.no", "No"),
        },
        {
          label: t("profile.hasCriminalRecord", "Criminal record"),
          value: profile.has_criminal_record
            ? profile.criminal_record_details || t("common.yes", "Yes")
            : t("common.no", "No"),
        },
        {
          label: t("profile.hasDualCitizenship", "Dual citizenship"),
          value: profile.has_dual_citizenship
            ? profile.second_passport_country || t("common.yes", "Yes")
            : t("common.no", "No"),
        },
      ]
    : [];

  return (
    <SectionCard
      title={t("admin.visa.visaInformation", "Visa information")}
      icon={User}
      actions={
        canEdit && editableFields.length > 0 ? (
          !editing ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDraft(values);
                setEditing(true);
              }}
            >
              <Edit3 className="h-3 w-3" />
              {t("common.edit", "Edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={saving}
                onClick={() => {
                  setDraft(values);
                  setEditing(false);
                }}
              >
                <X className="h-3 w-3" />
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={saving}
                onClick={async () => {
                  await onSaveValues(draft);
                  setEditing(false);
                }}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {t("common.save", "Save")}
              </Button>
            </div>
          )
        ) : null
      }
    >
      <div className="space-y-4">
        {editableFields.length > 0 ? (
          <div className="space-y-2">
            {editableFields.map((f) =>
              editing ? (
                renderInput(f)
              ) : (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 text-muted-foreground">
                    {isAr ? f.label_ar : f.label_en}
                  </span>
                  {renderValue(f, values[f.id] ?? "")}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("visa.noData", "No visa information on file yet.")}
          </p>
        )}

        {profileRows.length > 0 && (
          <div className="border-t border-border/50 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              {t("profile.legalSection", "Legal information")}
            </p>
            <div className="space-y-2">
              {profileRows.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="font-medium text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
