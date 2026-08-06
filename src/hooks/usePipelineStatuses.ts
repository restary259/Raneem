import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PIPELINE_STATUS_FALLBACK,
  PipelineStatus,
  statusColorClasses,
} from "@/lib/caseStatus";

let cache: PipelineStatus[] | null = null;
const listeners = new Set<(rows: PipelineStatus[]) => void>();

function publish(rows: PipelineStatus[]) {
  cache = rows;
  listeners.forEach((l) => l(rows));
}

export async function loadPipelineStatuses(force = false): Promise<PipelineStatus[]> {
  if (cache && !force) return cache;
  const { data, error } = await supabase
    .from("pipeline_statuses")
    .select("id, key, label_ar, label_en, color, sort_order, is_terminal, is_active")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    publish(PIPELINE_STATUS_FALLBACK);
    return PIPELINE_STATUS_FALLBACK;
  }
  publish(data as PipelineStatus[]);
  return data as PipelineStatus[];
}

export function usePipelineStatuses() {
  const [statuses, setStatuses] = useState<PipelineStatus[]>(cache ?? PIPELINE_STATUS_FALLBACK);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setStatuses);
    if (!cache) {
      loadPipelineStatuses().finally(() => setLoading(false));
    }
    return () => {
      listeners.delete(setStatuses);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadPipelineStatuses(true);
    setLoading(false);
  }, []);

  const active = statuses.filter((s) => s.is_active);

  const byKey = useCallback(
    (key: string) => statuses.find((s) => s.key === key),
    [statuses],
  );

  const label = useCallback(
    (key: string, isRtl: boolean) => {
      const row = byKey(key);
      if (!row) return key;
      return isRtl ? row.label_ar : row.label_en;
    },
    [byKey],
  );

  const colorClass = useCallback(
    (key: string) => statusColorClasses(byKey(key)?.color),
    [byKey],
  );

  return { statuses, active, loading, refresh, byKey, label, colorClass };
}
