import { useCallback, useEffect, useRef, useState } from "react";
import { CVData, createEmptyCVData, ALL_SECTIONS } from "./types";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "lebenslauf-draft";
const AUTOSAVE_DEBOUNCE = 1200;

/**
 * Merge a legacy stored draft into the current shape (new optional fields,
 * design/sectionOrder/signature) so older drafts still load without crashing.
 */
function migrateDraft(raw: unknown): CVData {
  const base = createEmptyCVData();
  const src = (raw ?? {}) as Partial<CVData>;
  const merged: CVData = {
    ...base,
    ...src,
    personal: { ...base.personal, ...(src.personal || {}) },
    skills: {
      languages: src.skills?.languages || [],
      technical: src.skills?.technical || [],
      other: src.skills?.other || [],
      interests: src.skills?.interests || [],
    },
    signature: { ...base.signature, ...(src.signature || {}) },
    design: { ...base.design, ...(src.design || {}) },
    sectionOrder:
      Array.isArray(src.sectionOrder) && src.sectionOrder.length > 0
        ? src.sectionOrder.filter((k) => ALL_SECTIONS.includes(k as never)) as CVData["sectionOrder"]
        : [...ALL_SECTIONS],
    // ensure new arrays exist for older drafts
    projects: src.projects || [],
    awards: src.awards || [],
    education: (src.education || []).map((e) => ({
      ...base.education[0],
      ...e,
      id: e.id || Math.random().toString(36).slice(2, 9),
      details: e.details || [],
      achievements: e.achievements || [],
      coursework: e.coursework || [],
    })),
    experience: (src.experience || []).map((e) => ({
      ...base.experience[0],
      ...e,
      id: e.id || Math.random().toString(36).slice(2, 9),
      bullets: e.bullets || [],
    })),
  };
  return merged;
}

export const useLebenslauf = () => {
  const { toast } = useToast();
  const { t } = useTranslation("resources");
  const [data, setData] = useState<CVData>(createEmptyCVData);
  const firstLoad = useRef(true);

  // Auto-restore on mount — a refresh no longer loses everything.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setData(migrateDraft(parsed?.data ?? parsed));
      toast({ title: t("lebenslaufBuilder.draftLoaded") });
    } catch {
      /* corrupt draft — start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save whenever data changes (after the initial restore).
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
      } catch {
        // quota / serialization (likely a large base64 photo) — non-fatal.
        toast({ title: t("lebenslaufBuilder.draftSaveFailed"), variant: "destructive" });
      }
    }, AUTOSAVE_DEBOUNCE);
    return () => window.clearTimeout(id);
  }, [data, t, toast]);

  const updateData = useCallback((partial: Partial<CVData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const updatePersonal = useCallback((partial: Partial<CVData["personal"]>) => {
    setData((prev) => ({ ...prev, personal: { ...prev.personal, ...partial } }));
  }, []);

  const updateDesign = useCallback((partial: Partial<CVData["design"]>) => {
    setData((prev) => ({ ...prev, design: { ...prev.design, ...partial } }));
  }, []);

  const updateSignature = useCallback((partial: Partial<CVData["signature"]>) => {
    setData((prev) => ({ ...prev, signature: { ...prev.signature, ...partial } }));
  }, []);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
      toast({ title: t("lebenslaufBuilder.draftSaved") });
    } catch {
      toast({ title: t("lebenslaufBuilder.draftSaveFailed"), variant: "destructive" });
    }
  }, [data, toast, t]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(migrateDraft(parsed?.data ?? parsed));
        toast({ title: t("lebenslaufBuilder.draftLoaded") });
      } else {
        toast({ title: t("lebenslaufBuilder.noDraft"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("lebenslaufBuilder.draftLoadFailed"), variant: "destructive" });
    }
  }, [toast, t]);

  const clearAll = useCallback(() => {
    if (!window.confirm(t("lebenslaufBuilder.clearConfirm"))) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setData(createEmptyCVData());
    toast({ title: t("lebenslaufBuilder.cleared") });
  }, [toast, t]);

  const handlePrint = useCallback(() => {
    // Print ONLY the CV preview into an isolated offscreen iframe so the
    // result is immune to the surrounding dashboard chrome, the mobile
    // preview/display:none toggle, and the app's global print CSS (the legacy
    // `body * { visibility: hidden }` hack in cv-print.css does not reach
    // inside this iframe). The cloned #cv-preview markup carries its own `dir`
    // attribute and inline designVars CSS custom properties, so RTL and the
    // selected design render exactly as on screen.
    const preview = document.getElementById("cv-preview");
    if (!preview) {
      toast({ title: t("lebenslaufBuilder.printFailed", "Could not find the CV to print."), variant: "destructive" });
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;inset-inline-start:0;top:-10000px;width:210mm;height:297mm;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    // Re-apply the app's compiled stylesheets (Tailwind utilities + template
    // classes + designVars) so the clone looks identical to the on-screen CV.
    const headLinks = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')) as HTMLElement[];

    doc.open();
    doc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>CV</title></head><body></body></html>");
    doc.close();

    for (const node of headLinks) {
      doc.head.appendChild(node.cloneNode(true));
    }

    // Override styles injected AFTER the app styles: in this isolated document
    // there is no dashboard chrome to hide, so neutralize the global
    // `body * { visibility: hidden }` / display:none rules and re-assert only
    // the page-break + @page rules we actually want. A static positioned root
    // lets long CVs paginate across A4 pages (position:fixed truncates to one).
    const override = doc.createElement("style");
    override.textContent = `
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      body * { visibility: visible !important; }
      #cv-preview, #cv-preview * { overflow: visible !important; max-height: none !important; }
      #cv-preview {
        position: static !important; left: auto !important; top: auto !important;
        width: 100% !important; max-width: none !important; margin: 0 !important;
        box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
      }
      .print\\:hidden { display: none !important; }
      @page { size: A4; margin: 10mm; }
      section, .cv-section { break-inside: auto; }
      .cv-entry, .cv-sidebar, .cv-timeline-entry { break-inside: avoid; page-break-inside: avoid; }
      h2, .cv-section > h2 { break-after: avoid; page-break-after: avoid; }
    `;
    doc.head.appendChild(override);

    // Clone only the preview (NOT its display:none parent column), so the
    // mobile-toggle can never blank the print. outerHTML preserves dir + the
    // inline designVars CSS custom properties set by CVPreview.
    doc.body.innerHTML = preview.outerHTML;

    const finish = () => {
      const cw = iframe.contentWindow;
      if (!cw) return;
      cw.focus();
      cw.print();
    };

    const cleanup = () => {
      window.removeEventListener("afterprint", cleanup);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const waitForImages = (root: Document | ShadowRoot): Promise<void> => {
      const imgs = Array.from(root.querySelectorAll("img"));
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
        )
      ).then(() => undefined);
    };

    // afterprint fires reliably in modern browsers; the timeout is a fallback
    // for the native print preview dialog staying open in some browsers.
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);

    const run = async () => {
      try {
        await waitForImages(doc);
        // Let the just-injected stylesheets apply before printing.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        finish();
      } catch {
        finish();
      }
    };
    void run();
  }, [t, toast]);

  return {
    data,
    setData,
    updateData,
    updatePersonal,
    updateDesign,
    updateSignature,
    saveDraft,
    loadDraft,
    clearAll,
    handlePrint,
  };
};
