import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Download, Save, Upload, Trash2, FileText, Eye } from "lucide-react";
import CVForm from "./CVForm";
import CVPreview from "./CVPreview";
import { useLebenslauf } from "./useLebenslauf";
import { CVData } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lightweight inline validation — only flags hard errors (name, email, dates). */
function validate(data: CVData, t: (k: string, fb: string) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!data.personal.firstName.trim()) e.firstName = t("lebenslaufBuilder.val_nameRequired", "Name is required");
  if (!data.personal.lastName.trim()) e.lastName = t("lebenslaufBuilder.val_nameRequired", "Name is required");
  if (data.personal.email && !EMAIL_RE.test(data.personal.email)) e.email = t("lebenslaufBuilder.val_email", "Enter a valid email");
  for (const ed of data.education) {
    if (ed.from && ed.to && !ed.current && ed.from > ed.to) e[`edu_${ed.id}`] = t("lebenslaufBuilder.val_dates", "Start date must be before end date");
  }
  return e;
}

const LebenslaufBuilder: React.FC = () => {
  const { t } = useTranslation("resources");
  const { data, setData, updateData, updatePersonal, updateDesign, updateSignature, saveDraft, loadDraft, clearAll, handlePrint: doPrint } = useLebenslauf();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  const errors = useMemo(() => validate(data, (k, fb) => t(k, fb) as string), [data, t]);

  const canPrint = !errors.firstName && !errors.lastName && !errors.email;

  const onPrint = () => {
    if (!canPrint) return;
    doPrint();
  };

  return (
    <div className="lebenslauf-builder">
      {/* FAQ-Style Description */}
      <div className="mb-8 p-6 bg-accent/5 border border-accent/20 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">{t("lebenslaufBuilder.faqTitle")}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>{t("lebenslaufBuilder.faqQ1")}</strong> {t("lebenslaufBuilder.faqA1")}</p>
          <p><strong>{t("lebenslaufBuilder.faqQ2")}</strong> {t("lebenslaufBuilder.faqA2")}</p>
          <p><strong>{t("lebenslaufBuilder.faqQ3")}</strong> {t("lebenslaufBuilder.faqA3")}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <Button onClick={onPrint} disabled={!canPrint} className="gap-2" title={!canPrint ? t("lebenslaufBuilder.val_fixFirst", "Fix required fields first") : undefined}><Download className="h-4 w-4" />{t("lebenslaufBuilder.actions.downloadPDF")}</Button>
        <Button variant="outline" onClick={saveDraft} className="gap-2"><Save className="h-4 w-4" />{t("lebenslaufBuilder.actions.saveDraft")}</Button>
        <Button variant="outline" onClick={loadDraft} className="gap-2"><Upload className="h-4 w-4" />{t("lebenslaufBuilder.actions.loadDraft")}</Button>
        <Button variant="destructive" onClick={clearAll} className="gap-2"><Trash2 className="h-4 w-4" />{t("lebenslaufBuilder.actions.clearAll")}</Button>
      </div>

      {/* Mobile toggle */}
      <div className="flex gap-2 mb-4 lg:hidden print:hidden">
        <Button size="sm" variant={mobileTab === "edit" ? "default" : "outline"} onClick={() => setMobileTab("edit")} className="gap-1.5"><FileText className="h-4 w-4" />{t("lebenslaufBuilder.edit", "Edit")}</Button>
        <Button size="sm" variant={mobileTab === "preview" ? "default" : "outline"} onClick={() => setMobileTab("preview")} className="gap-1.5"><Eye className="h-4 w-4" />{t("lebenslaufBuilder.preview")}</Button>
      </div>

      {/* Two-column layout (desktop) / toggle (mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`print:hidden ${mobileTab === "edit" ? "block" : "hidden"} lg:block`}>
          <CVForm data={data} setData={setData} updatePersonal={updatePersonal} updateData={updateData} updateDesign={updateDesign} updateSignature={updateSignature} errors={errors} />
        </div>
        <div className={`${mobileTab === "preview" ? "block" : "hidden"} lg:block`}>
          <div className="lg:sticky lg:top-20">
            <h3 className="text-lg font-medium mb-3 print:hidden">{t("lebenslaufBuilder.preview")}</h3>
            <CVPreview data={data} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LebenslaufBuilder;
