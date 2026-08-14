import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * True when the signed-in team member has been promoted to manager
 * (`profiles.is_manager`, admin-only settable). Managers see the full pipeline
 * and can assign cases to team members; non-managers keep the assigned-only
 * view. The flag is read-only here — the restrict_profiles_write trigger
 * blocks non-admins from changing it.
 */
export function useIsManager() {
  const { user, role, initialized } = useAuth();
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user || role !== 'team_member') {
        if (active) { setIsManager(false); setLoading(false); }
        return;
      }
      const { data } = await (supabase as any)
        .from('profiles')
        .select('is_manager')
        .eq('id', user.id)
        .maybeSingle();
      if (active) {
        setIsManager(!!data?.is_manager);
        setLoading(false);
      }
    };
    if (initialized) run();
    return () => { active = false; };
  }, [user, role, initialized]);

  return { isManager, loading };
}

export default useIsManager;
