import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'team_member' | 'social_media_partner' | 'student';

export const ROLE_TO_PATH: Record<AppRole, string> = {
  admin: '/admin',
  team_member: '/team',
  social_media_partner: '/partner',
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
      if (error || !data) return null;
      return data as AppRole;
    } catch {
      return null;
    }
  };

  const fetchMustChangePassword = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', userId)
        .maybeSingle();
      return data?.must_change_password ?? false;
    } catch {
      return false;
    }
  };

  const initializeAuth = async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
      return;
    }

    // Validate session is still alive — if getUser fails, sign out silently
    try {
      const { error: userError } = await supabase.auth.getUser(session.access_token);
      if (userError) {
        await supabase.auth.signOut();
        setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
        return;
      }
    } catch {
      await supabase.auth.signOut();
      setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
      return;
    }

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }

      if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, role: null, mustChangePassword: false, initialized: true });
        return;
      }

      await initializeAuth(session);
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
      initializeAuth(session);
    });

    return () => {
      subscription.unsubscribe();
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (!state.user) return;
    const [role, mustChangePassword] = await Promise.all([
      fetchRole(state.user.id),
      fetchMustChangePassword(state.user.id),
    ]);
    setState(prev => ({ ...prev, role, mustChangePassword }));
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
