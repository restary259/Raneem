import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadVisaDetail, type VisaDetail } from "@/services/VisaService";

/**
 * Loads the full detail payload for one opened visa case and keeps it live:
 * when the student (or staff) uploads a document, only this open detail
 * refreshes — the queue is not refetched. Reuses the same `postgres_changes`
 * pattern as `DocumentsPanel` rather than adding a second realtime stack.
 */
export function useVisaDetail(
  caseId: string | null,
  studentUserId: string | null,
  options?: { onDocumentChange?: () => void },
) {
  const [detail, setDetail] = useState<VisaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cancelled = useRef(false);
  const onDocumentChange = options?.onDocumentChange;

  const refresh = useCallback(async () => {
    if (!caseId || !studentUserId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await loadVisaDetail(caseId, studentUserId);
      if (!cancelled.current) setDetail(next);
    } catch (e) {
      if (!cancelled.current) setError(e);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [caseId, studentUserId]);

  useEffect(() => {
    cancelled.current = false;
    void refresh();
    return () => {
      cancelled.current = true;
    };
  }, [refresh]);

  // Live document updates for the open student only.
  useEffect(() => {
    if (!studentUserId) return;
    const channel = supabase
      .channel(`admin-visa-docs-${studentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `student_id=eq.${studentUserId}`,
        },
        () => {
          void refresh();
          onDocumentChange?.();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentUserId, refresh, onDocumentChange]);

  return { detail, loading, error, refresh };
}
