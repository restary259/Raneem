
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Profile, VisaStatus } from '@/types/profile';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardMainContent from '@/components/dashboard/DashboardMainContent';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import DashboardErrorBoundary from '@/components/dashboard/DashboardErrorBoundary';
import { useAuthDebug } from '@/hooks/useAuthDebug';

const StudentDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Debug auth state
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
        
        // Fetch profile with better error handling
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

    // Listen for auth changes
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
        // Defer profile fetching to prevent deadlocks
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
      
      // Use a more direct query to avoid RLS issues
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('🏠 Profile fetch error:', error);
        
        // If profile doesn't exist, create a basic one
        if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
          console.log('🏠 No profile found, creating one...');
          await createUserProfile(userId);
          return;
        }
        
        // For RLS issues, try to create profile anyway
        if (error.message.includes('infinite recursion')) {
          console.log('🏠 RLS recursion detected, attempting profile creation...');
          await createUserProfile(userId);
          return;
        }
        
        throw error;
      }

      if (data) {
        console.log('🏠 Profile loaded successfully:', data.id);
        
        // Safely cast visa_status
        const allowedStatuses: VisaStatus[] = [
          'not_applied', 'applied', 'approved', 'rejected', 'received'
        ];
        const safeProfile: Profile = {
          ...data,
          visa_status: allowedStatuses.includes(data.visa_status) ? data.visa_status : 'not_applied',
        };

        setProfile(safeProfile);
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
      // Create a minimal profile for display
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
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);
    }
  };

  // Show error state
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

  // Show loading state
  if (isLoading) {
    return <DashboardLoading />;
  }

  // Show simple test component first
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

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader fullName={profile.full_name} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <DashboardSidebar 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />
            
            <DashboardMainContent
              activeTab={activeTab}
              profile={profile}
              user={user}
              onProfileUpdate={fetchProfileSafely}
            />
          </div>
        </div>
      </div>
    </DashboardErrorBoundary>
  );
};

export default StudentDashboardPage;
