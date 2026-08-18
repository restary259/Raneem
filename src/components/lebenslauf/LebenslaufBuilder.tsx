import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Download, Save, Upload, Trash2, FileText, Eye, ChevronDown, CircleHelp } from "lucide-react";
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

interface LebenslaufBuilderProps {
  /** When embedded in the dashboard (short h-14 header, scrolling main),
   *  pass true so the form + preview become independent scrolling panes and
   *  the FAQ/toolbar stay fixed. Defaults to false (public marketing page,
   *  tall header) so the existing public behavior is unchanged. */
  embedded?: boolean;
  /** Sticky offset class for the preview column. Defaults to lg:top-20
   *  (calibrated for the tall public header). The dashboard passes a smaller
   *  value so the preview aligns under its h-14 header. */
  stickyTopClassName?: string;
}

const LebenslaufBuilder: React.FC<LebenslaufBuilderProps> = ({
  embedded = false,
  stickyTopClassName = "lg:top-20",
}) => {
  const { t } = useTranslation("resources");
  const { data, setData, updateData, updatePersonal, updateDesign, updateSignature, saveDraft, loadDraft, clearAll, downloadPdf, generating } = useLebenslauf();
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [faqOpen, setFaqOpen] = useState(false);

  const errors = useMemo(() => validate(data, (k, fb) => t(k, fb) as string), [data, t]);

  const canPrint = !errors.firstName && !errors.lastName && !errors.email;

  const onDownload = () => {
    if (!canPrint || generating) return;
    void downloadPdf();
  };

  // Only the form + preview panes scroll in the dashboard; everything else
  // (FAQ, toolbar, mobile toggle) stays put. On the public page (embedded=false)
  // the whole section scrolls as before.
  const rootCls = embedded
    ? "lebenslauf-builder lg:h-full lg:flex lg:flex-col lg:overflow-hidden"
    : "lebenslauf-builder";
  const headerCls = embedded ? "lg:shrink-0" : "";
  const gridCls = embedded
    ? "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden"
    : "grid grid-cols-1 lg:grid-cols-2 gap-6";
  const paneCls = embedded ? "lg:overflow-y-auto lg:min-h-0 lg:pr-1" : "";

  return (
    <div className={rootCls}>
      {/* FAQ-Style Description (collapsible to save screen space) */}
      <Collapsible open={faqOpen} onOpenChange={setFaqOpen} className={`mb-4 bg-accent/5 border border-accent/20 rounded-lg ${headerCls}`}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left">
            <CircleHelp className="h-4 w-4 shrink-0 text-accent-foreground/70" />
            <span className="text-sm font-medium flex-1">{t("lebenslaufBuilder.faqTitle")}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${faqOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 text-sm text-muted-foreground px-4 pb-4 pt-1">
            <p><strong>{t("lebenslaufBuilder.faqQ1")}</strong> {t("lebenslaufBuilder.faqA1")}</p>
            <p><strong>{t("lebenslaufBuilder.faqQ2")}</strong> {t("lebenslaufBuilder.faqA2")}</p>
            <p><strong>{t("lebenslaufBuilder.faqQ3")}</strong> {t("lebenslaufBuilder.faqA3")}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Toolbar */}
      <div className={`flex flex-wrap gap-2 mb-6 print:hidden ${headerCls}`}>
        <Button onClick={onDownload} disabled={!canPrint || generating} className="gap-2" title={!canPrint ? t("lebenslaufBuilder.val_fixFirst", "Fix required fields first") : undefined}><Download className="h-4 w-4" />{generating ? t("lebenslaufBuilder.pdfGenerating", "Generating…") : t("lebenslaufBuilder.actions.downloadPDF")}</Button>
        <Button variant="outline" onClick={saveDraft} className="gap-2"><Save className="h-4 w-4" />{t("lebenslaufBuilder.actions.saveDraft")}</Button>
        <Button variant="outline" onClick={loadDraft} className="gap-2"><Upload className="h-4 w-4" />{t("lebenslaufBuilder.actions.loadDraft")}</Button>
        <Button variant="destructive" onClick={clearAll} className="gap-2"><Trash2 className="h-4 w-4" />{t("lebenslaufBuilder.actions.clearAll")}</Button>
      </div>

      {/* Mobile toggle */}
      <div className={`flex gap-2 mb-4 lg:hidden print:hidden ${headerCls}`}>
        <Button size="sm" variant={mobileTab === "edit" ? "default" : "outline"} onClick={() => setMobileTab("edit")} className="gap-1.5"><FileText className="h-4 w-4" />{t("lebenslaufBuilder.edit", "Edit")}</Button>
        <Button size="sm" variant={mobileTab === "preview" ? "default" : "outline"} onClick={() => setMobileTab("preview")} className="gap-1.5"><Eye className="h-4 w-4" />{t("lebenslaufBuilder.preview")}</Button>
      </div>

      {/* Two-column layout (desktop) / toggle (mobile) */}
      <div className={gridCls}>
        <div className={`print:hidden ${mobileTab === "edit" ? "block" : "hidden"} lg:block ${paneCls}`}>
          <CVForm data={data} setData={setData} updatePersonal={updatePersonal} updateData={updateData} updateDesign={updateDesign} updateSignature={updateSignature} errors={errors} />
        </div>
        <div className={`${mobileTab === "preview" ? "block" : "hidden"} lg:block ${paneCls}`}>
          <div className={`lg:sticky ${stickyTopClassName}`}>
            <h3 className="text-lg font-medium mb-3 print:hidden">{t("lebenslaufBuilder.preview")}</h3>
            <CVPreview data={data} />
          </div>
        </div>
      </div>

      {/* Off-screen, always-mounted capture copy. This is what the PDF path
          rasterizes so generation works regardless of the mobile edit/preview
          toggle (html2canvas cannot capture a display:none element). It is
          positioned off-canvas and rendered at native A4 width (scaled=false
          → 794px, no transform) so html2canvas captures the unscaled sheet
          and the jsPDF A4 slices align to real page boundaries; it is excluded
          from the print stylesheet. */}
      <div
        aria-hidden="true"
        className="fixed -left-[10000px] top-0 pointer-events-none print:hidden"
        style={{ zIndex: -1, width: "210mm" }}
      >
        <CVPreview data={data} id="cv-capture" scaled={false} />
      </div>
    </div>
  );
};

export default LebenslaufBuilder;
