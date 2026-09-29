import { useCallback, useEffect, useRef, useState } from "react";
import { loadVisaQueue, type VisaQueueRow } from "@/services/VisaService";

/**
 * Loads the Admin Visa queue (enrolled cases with a student account) from the
 * admin-gated `get_admin_visa_queue` RPC and refreshes it on demand.
 *
 * The queue is deliberately small (one row per enrolled case) so it is fetched
 * whole; the heavy per-student data (documents) is loaded only when a case is
 * opened, by `useVisaDetail`.
 */
export function useVisaQueue() {
  const [rows, setRows] = useState<VisaQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const cancelled = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadVisaQueue();
      if (!cancelled.current) setRows(data);
    } catch (e) {
      if (!cancelled.current) setError(e);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    void refresh();
    return () => {
      cancelled.current = true;
    };
  }, [refresh]);

  return { rows, loading, error, refresh };
}
