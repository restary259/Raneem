
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearChatHistory } from '@/utils/chatCache';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const useSessionTimeout = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const logout = useCallback(async () => {
    clearChatHistory();
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes('darb-ai-cache')) {
          await caches.delete(name);
        }
      }
    } catch (err) {
      // Cache eviction is best-effort — sign-out must still happen.
      console.warn('[sessionTimeout] failed to clear AI caches:', err);
    }
    await supabase.auth.signOut();
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      logout().catch((err) => console.error('[sessionTimeout] logout failed:', err));
    }, TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    const checkAndStart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Only activate timeout for admin users
      const { data: roles, error: rolesError } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');
      if (rolesError) {
        console.error('[sessionTimeout] admin role lookup failed:', rolesError);
        return;
      }

      const isAdmin = roles && roles.length > 0;
      if (!isAdmin) return; // Non-admin users get permanent sessions

      resetTimer();
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

      return () => {
        events.forEach(e => window.removeEventListener(e, resetTimer));
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    };

    const cleanup = checkAndStart();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (event === 'SIGNED_IN') {
        // Re-check on sign in (will only start timer if admin)
        checkAndStart().catch((err) => console.error('[sessionTimeout] restart failed:', err));
      }
    });

    return () => {
      cleanup
        .then(fn => fn?.())
        .catch((err) => console.error('[sessionTimeout] start failed:', err));
      subscription.unsubscribe();
    };
  }, [resetTimer]);
};
