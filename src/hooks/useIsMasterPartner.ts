import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * True when the signed-in partner has been upgraded to master partner.
 * The flag lives on `profiles.is_master_partner` and can only be set by an admin.
 */
export function useIsMasterPartner() {
  const { user, role } = useAuth();
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!user || role !== 'social_media_partner') {
        if (active) { setIsMaster(false); setLoading(false); }
        return;
      }
      const { data } = await (supabase as any)
        .from('profiles')
        .select('is_master_partner')
        .eq('id', user.id)
        .maybeSingle();
      if (active) {
        setIsMaster(!!data?.is_master_partner);
        setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [user, role]);

  return { isMaster, loading };
}

export default useIsMasterPartner;
