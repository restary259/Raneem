import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  payload: Record<string, unknown>;
  is_internal: boolean;
  created_at: string;
}

export const CASE_EVENTS_PAGE_SIZE = 25;

/**
 * Loads the user-facing timeline for a case. RLS decides what is visible:
 * admins see everything, team members see their assigned cases, students see
 * their own case minus internal-only entries.
 */
export function useCaseEvents(caseId: string | undefined) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(CASE_EVENTS_PAGE_SIZE);

  const fetchEvents = useCallback(
    async (nextLimit: number) => {
      if (!caseId) {
        setEvents([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: err } = await supabase
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(nextLimit + 1);

      if (err) {
        setError(err.message);
        setEvents([]);
      } else {
        const rows = (data ?? []) as unknown as CaseEvent[];
        setError(null);
        setHasMore(rows.length > nextLimit);
        setEvents(rows.slice(0, nextLimit));
      }
      setLoading(false);
    },
    [caseId],
  );

  useEffect(() => {
    void fetchEvents(limit);
  }, [fetchEvents, limit]);

  const loadMore = useCallback(() => setLimit((l) => l + CASE_EVENTS_PAGE_SIZE), []);
  const refetch = useCallback(() => fetchEvents(limit), [fetchEvents, limit]);

  return { events, loading, error, hasMore, loadMore, refetch };
}

/** Records a manual note on the case timeline. Actor is forced server-side. */
export async function addCaseNote(caseId: string, text: string, isInternal = true) {
  const trimmed = text.trim();
  if (!trimmed) return { error: null };
  const { error } = await supabase.rpc("log_case_event", {
    p_case_id: caseId,
    p_event_type: "note_added",
    p_payload: { text: trimmed.slice(0, 2000) },
    p_is_internal: isInternal,
  });
  return { error };
}
