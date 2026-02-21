
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_NONCE_KEY = 'darb_session_nonce';

/**
 * Single-session enforcement hook.
 * Monitors the `active_sessions` table via Realtime + polling.
 * If the current session is replaced by a login elsewhere, shows a flag
 * and signs the user out.
 */
export const useSessionGuard = () => {
  const [kicked, setKicked] = useState(false);
  const navigate = useNavigate();
  const userIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const kickedRef = useRef(false);

  const getLocalNonce = () => localStorage.getItem(SESSION_NONCE_KEY);

  const handleKick = useCallback(async () => {
    if (kickedRef.current) return;
    kickedRef.current = true;
    setKicked(true);

    // Auto-dismiss after 5 seconds
    setTimeout(async () => {
      localStorage.removeItem(SESSION_NONCE_KEY);
      try { await supabase.auth.signOut(); } catch {}
      navigate('/student-auth', { replace: true });
    }, 5000);
  }, [navigate]);

  const checkSession = useCallback(async () => {
    const nonce = getLocalNonce();
    if (!userIdRef.current || !nonce || kickedRef.current) return;

    try {
      const { data } = await (supabase as any)
        .from('active_sessions')
        .select('session_id')
        .eq('user_id', userIdRef.current)
        .maybeSingle();

      if (data && data.session_id !== nonce) {
        handleKick();
      }
    } catch {
      // Network error — skip, will retry on next poll
    }
  }, [handleKick]);

  useEffect(() => {
    let channel: any = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      userIdRef.current = userId;
      kickedRef.current = false;

      const nonce = getLocalNonce();

      // If no nonce stored (e.g. direct supabase login, not via auth-guard),
      // check if there's a matching row. If not, skip guard (auth-guard will set it on next login).
      if (!nonce) return;

      // Verify current nonce still matches the DB
      try {
        const { data: existing } = await (supabase as any)
          .from('active_sessions')
          .select('session_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing && existing.session_id !== nonce) {
          handleKick();
          return;
        }
      } catch {}

      // Subscribe to realtime changes
      channel = supabase
        .channel(`session-guard-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'active_sessions',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            const newSessionId = payload.new?.session_id;
            const localNonce = getLocalNonce();
            if (newSessionId && localNonce && newSessionId !== localNonce) {
              handleKick();
            }
          }
        )
        .subscribe();

      // Fallback polling every 60 seconds
      pollRef.current = setInterval(checkSession, 60_000);
    };

    setup();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        userIdRef.current = null;
        localStorage.removeItem(SESSION_NONCE_KEY);
        if (pollRef.current) clearInterval(pollRef.current);
        if (channel) supabase.removeChannel(channel);
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (channel) supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, [checkSession, handleKick]);

  const acknowledgeKick = useCallback(async () => {
    localStorage.removeItem(SESSION_NONCE_KEY);
    try { await supabase.auth.signOut(); } catch {}
    navigate('/student-auth', { replace: true });
  }, [navigate]);

  return { kicked, acknowledgeKick };
};
