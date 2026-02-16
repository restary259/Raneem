import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to real-time changes on a Supabase table.
 * Calls `onUpdate` whenever an INSERT, UPDATE, or DELETE occurs.
 * When `refetchOnFocus` is true, also refetches when the browser tab regains focus.
 */
export function useRealtimeSubscription(
  tableName: string,
  onUpdate: () => void,
  enabled = true,
  refetchOnFocus = true
) {
  // Realtime channel
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`${tableName}-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, onUpdate, enabled]);

  // Refetch on window focus (visibilitychange)
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onUpdate, enabled, refetchOnFocus]);
}
