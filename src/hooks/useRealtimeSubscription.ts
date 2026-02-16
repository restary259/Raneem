import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to real-time changes on a Supabase table.
 * Calls `onUpdate` whenever an INSERT, UPDATE, or DELETE occurs.
 */
export function useRealtimeSubscription(
  tableName: string,
  onUpdate: () => void,
  enabled = true
) {
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
}
