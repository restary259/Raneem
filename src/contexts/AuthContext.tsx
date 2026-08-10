import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { unsubscribeFromPush } from '@/lib/webPush';

export type AppRole = 'admin' | 'team_member' | 'social_media_partner' | 'ambassador' | 'student';

export const ROLE_TO_PATH: Record<AppRole, string> = {
  admin: '/admin',
  team_member: '/team',
  social_media_partner: '/partner',
  ambassador: '/partner',
  student: '/student/checklist',
};

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  mustChangePassword: boolean;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    mustChangePassword: false,
    initialized: false,
  });

  const safetyTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchRole = async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase.rpc('get_my_role');
      if (error) {
        console.error('[auth] role lookup failed:', error);
        return null;
      }
      if (!data) return null;
      return data as AppRole;
    } catch (err) {
      console.error('[auth] role lookup threw:', err);
      return null;
    }
  };

  const fetchMustChangePassword = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.error('[auth] must_change_password lookup failed:', error);
      return data?.must_change_password ?? false;
    } catch (err) {
      console.error('[auth] must_change_password lookup threw:', err);
      return false;
    }
  };

  const initializeAuth = async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
      return;
    }

    // Trust the session provided by onAuthStateChange / getSession — no extra getUser call
    // (getUser(token) causes 401s for newly-set sessions and is redundant here)
    const [role, mustChangePassword] = await Promise.all([
      fetchRole(session.user.id),
      fetchMustChangePassword(session.user.id),
    ]);

    setState({
      user: session.user,
      session,
      role,
      mustChangePassword,
      initialized: true,
    });
  };

  useEffect(() => {
    // Safety net: mark initialized after 6s even if auth hangs
    safetyTimer.current = setTimeout(() => {
      setState(prev => ({ ...prev, initialized: true }));
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }

      if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
        return;
      }

      // USER_UPDATED fires after updateUser() — re-initialize to pick up fresh session
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Fire-and-forget: never await inside onAuthStateChange to avoid Supabase internal lock deadlocks
        initializeAuth(session);
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
      initializeAuth(session);
    }).catch((err) => {
      console.error('[auth] initial getSession failed:', err);
      setState(prev => ({ ...prev, initialized: true }));
    });

    return () => {
      subscription.unsubscribe();
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  const signOut = async () => {
    // Release this device's push subscription first — otherwise the endpoint
    // stays bound to the outgoing account and the phone keeps receiving that
    // user's notifications until someone signs in again on this device.
    const currentUserId = state.user?.id;
    if (currentUserId) {
      try {
        await unsubscribeFromPush(currentUserId);
      } catch (err) {
        /* never block sign-out on push cleanup */
        console.warn('[auth] push unsubscribe failed during sign-out:', err);
      }
    }
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    // Fall back to the live session: right after signInWithPassword the context
    // state may not have been updated by onAuthStateChange yet.
    let currentUser = state.user;
    let currentSession = state.session;
    if (!currentUser) {
      const { data } = await supabase.auth.getSession();
      currentSession = data.session ?? null;
      currentUser = currentSession?.user ?? null;
    }
    if (!currentUser) return;
    const [role, mustChangePassword] = await Promise.all([
      fetchRole(currentUser.id),
      fetchMustChangePassword(currentUser.id),
    ]);
    setState(prev => ({
      ...prev,
      user: prev.user ?? currentUser,
      session: prev.session ?? currentSession,
      role,
      mustChangePassword,
      initialized: true,
    }));
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
