
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
    } catch {}
    await supabase.auth.signOut();
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    const checkAndStart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Only activate timeout for admin users
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin');

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
        checkAndStart();
      }
    });

    return () => {
      cleanup.then(fn => fn?.());
      subscription.unsubscribe();
    };
  }, [resetTimer]);
};
