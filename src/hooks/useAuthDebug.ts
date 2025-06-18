
import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuthDebug = () => {
  const [debugInfo, setDebugInfo] = useState({
    user: null as User | null,
    session: null as Session | null,
    loading: true,
    error: null as string | null,
    authStateChanges: [] as string[]
  });

  useEffect(() => {
    console.log('🔍 Auth Debug Hook initialized');
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔍 Initial session error:', error);
          setDebugInfo(prev => ({ ...prev, error: error.message, loading: false }));
          return;
        }
        
        console.log('🔍 Initial session:', session);
        setDebugInfo(prev => ({ 
          ...prev, 
          session, 
          user: session?.user || null, 
          loading: false,
          authStateChanges: [...prev.authStateChanges, `Initial: ${session ? 'authenticated' : 'not authenticated'}`]
        }));
      } catch (err: any) {
        console.error('🔍 Initial session catch error:', err);
        setDebugInfo(prev => ({ ...prev, error: err.message, loading: false }));
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 Auth state change:', { event, session, user: session?.user });
      
      setDebugInfo(prev => ({
        ...prev,
        session,
        user: session?.user || null,
        loading: false,
        authStateChanges: [...prev.authStateChanges, `${event}: ${session ? 'authenticated' : 'not authenticated'}`]
      }));
    });

    return () => {
      console.log('🔍 Auth debug cleanup');
      subscription.unsubscribe();
    };
  }, []);

  return debugInfo;
};
