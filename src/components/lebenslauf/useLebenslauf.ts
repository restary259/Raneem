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
    window.print();
  }, []);

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
