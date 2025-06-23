
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Profile } from '@/types/profile';
import LoadingState from '@/components/dashboard/LoadingState';
import { useAuthDebug } from '@/hooks/useAuthDebug';
import ProgramsGrid from '@/components/programs/ProgramsGrid';
import MessagesHub from '@/components/messages/MessagesHub';

const StudentDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const authDebug = useAuthDebug();

  useEffect(() => {
    console.log('🏠 Dashboard Page mounted');
    console.log('🏠 Auth Debug Info:', authDebug);
  }, [authDebug]);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        console.log('🏠 Initializing dashboard...');
        setIsLoading(true);
        setError(null);
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('🏠 Session error:', sessionError);
          throw sessionError;
        }
        
        if (!session?.user) {
          console.log('🏠 No authenticated user, redirecting to auth');
          navigate('/student-auth');
          return;
        }
        
        console.log('🏠 Authenticated user found:', session.user.id);
        setUser(session.user);
        
        await fetchProfileSafely(session.user.id);
        
      } catch (error: any) {
        console.error('🏠 Dashboard initialization error:', error);
        setError(error.message);
        toast({
          variant: "destructive",
          title: "خطأ في تحميل لوحة التحكم",
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🏠 Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_OUT' || !session?.user) {
        console.log('🏠 User signed out, redirecting');
        navigate('/student-auth');
        return;
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('🏠 User signed in/token refreshed');
        setUser(session.user);
        setTimeout(() => {
          fetchProfileSafely(session.user.id);
        }, 100);
      }
    });

    return () => {
      console.log('🏠 Dashboard cleanup');
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const fetchProfileSafely = async (userId: string) => {
    try {
      console.log('🏠 Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('🏠 Profile fetch error:', error);
        
        if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
          console.log('🏠 No profile found, creating one...');
          await createUserProfile(userId);
          return;
        }
        
        if (error.message.includes('infinite recursion')) {
          console.log('🏠 RLS recursion detected, attempting profile creation...');
          await createUserProfile(userId);
          return;
        }
        
        throw error;
      }

      if (data) {
        console.log('🏠 Profile loaded successfully:', data.id);
        setProfile(data);
      } else {
        console.log('🏠 No profile data, creating one...');
        await createUserProfile(userId);
      }
      
    } catch (error: any) {
      console.error('🏠 Profile fetch error:', error);
      setError(`خطأ في تحميل البيانات: ${error.message}`);
      toast({
        variant: "destructive",
        title: "خطأ في تحميل البيانات",
        description: error.message,
      });
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const profileData = {
        id: userId,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email || 'مستخدم جديد',
        phone_number: user.user_metadata?.phone_number || null,
        country: user.user_metadata?.country || null,
      };

      console.log('🏠 Creating profile with data:', profileData);

      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error('🏠 Profile creation error:', error);
        throw error;
      }

      console.log('🏠 Profile created successfully:', data);
      setProfile(data);
      
    } catch (error: any) {
      console.error('🏠 Profile creation failed:', error);
      const fallbackProfile: Profile = {
        id: userId,
        email: user?.email || '',
        full_name: user?.user_metadata?.full_name || 'مستخدم جديد',
        phone_number: null,
        country: null,
        university_name: null,
        intake_month: null,
        visa_status: 'not_applied',
        notes: null,
      };
      setProfile(fallbackProfile);
    }
  };

  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">خطأ في تحميل لوحة التحكم</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingState type="dashboard" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    console.log('🏠 Missing user or profile data:', { user: !!user, profile: !!profile });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">جار تحميل بيانات المستخدم...</div>
          <div className="text-sm text-gray-500 mt-2">
            المستخدم: {user ? '✓' : '✗'} | البيانات الشخصية: {profile ? '✓' : '✗'}
          </div>
        </div>
      </div>
    );
  }

  // Default to Programs view - this will be the main dashboard
  return <ProgramsGrid />;
};

export default StudentDashboardPage;
