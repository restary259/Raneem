import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AUTH_ROUTE = '/student-auth';

/**
 * Resolves the signed-in Supabase user id for dashboard pages and redirects to
 * the auth route when there is no session. `onUser` runs once with the resolved
 * id, so pages can kick off their initial fetch from the same round trip.
 */
export function useAuthedUserId(onUser?: (userId: string) => void): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const onUserRef = useRef(onUser);
  onUserRef.current = onUser;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate(AUTH_ROUTE);
        return;
      }
      setUserId(session.user.id);
      onUserRef.current?.(session.user.id);
    });
  }, [navigate]);

  return userId;
}
