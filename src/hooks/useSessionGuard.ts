
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_NONCE_KEY = 'darb_session_nonce';

/**
 * Multi-device session guard.
 * No longer kicks users when another device logs in.
 * Only handles graceful session expiry (e.g. token invalidation).
 */
export const useSessionGuard = () => {
  const [kicked, setKicked] = useState(false);
  const navigate = useNavigate();
  const autoKickTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Listen for auth state changes — handle graceful expiry
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(SESSION_NONCE_KEY);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (autoKickTimerRef.current) clearTimeout(autoKickTimerRef.current);
    };
  }, []);

  // Clean up own session on manual logout
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Don't remove session on page close — multi-device means sessions persist
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const acknowledgeKick = useCallback(async () => {
    if (autoKickTimerRef.current) clearTimeout(autoKickTimerRef.current);
    setKicked(false);
    localStorage.removeItem(SESSION_NONCE_KEY);
    try { await supabase.auth.signOut(); } catch {}
    navigate('/student-auth', { replace: true });
  }, [navigate]);

  return { kicked, acknowledgeKick };
};
