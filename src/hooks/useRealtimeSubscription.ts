import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to real-time changes on a Supabase table.
 * Calls `onUpdate` whenever an INSERT, UPDATE, or DELETE occurs.
 * When `refetchOnFocus` is true, also refetches when the browser tab regains focus.
 * Debounces near-simultaneous events (e.g. trigger touching multiple tables) into one call.
 */
export function useRealtimeSubscription(
  tableName: string,
  onUpdate: () => void,
  enabled = true,
  refetchOnFocus = true
) {
  // Store onUpdate in a ref to keep the debounced callback stable
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedUpdate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdateRef.current();
    }, 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Realtime channel
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`${tableName}-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => debouncedUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, debouncedUpdate, enabled]);

  // Refetch on window focus (visibilitychange)
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [debouncedUpdate, enabled, refetchOnFocus]);
}
