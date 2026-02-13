
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

const StudentDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('checklist');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session?.user) {
          navigate('/student-auth');
          return;
        }

        setUser(session.user);
        await fetchProfileSafely(session.user.id);
      } catch (error: any) {
        setError(error.message);
        toast({ variant: "destructive", title: "خطأ في تحميل لوحة التحكم", description: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        navigate('/student-auth');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user);
        setTimeout(() => fetchProfileSafely(session.user.id), 100);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const fetchProfileSafely = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('infinite recursion')) {
          await createUserProfile(userId);
          return;
        }
        throw error;
      }

      if (data) {
        const allowedStatuses: VisaStatus[] = ['not_applied', 'applied', 'approved', 'rejected', 'received'];
        setProfile({
          ...data,
          visa_status: allowedStatuses.includes(data.visa_status) ? data.visa_status : 'not_applied',
        });
      } else {
        await createUserProfile(userId);
      }
    } catch (error: any) {
      setError(`خطأ في تحميل البيانات: ${error.message}`);
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('User not found');

      const { data, error } = await (supabase as any)
        .from('profiles')
        .insert({
          id: userId,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email || 'مستخدم جديد',
          phone_number: authUser.user_metadata?.phone_number || null,
          country: authUser.user_metadata?.country || null,
        })
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      const fallback: Profile = {
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
      setProfile(fallback);
    }
  };

  if (error && !isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">خطأ في تحميل لوحة التحكم</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  if (isLoading) return <DashboardLoading />;

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">جار تحميل بيانات المستخدم...</div>
        </div>
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC]">
        <DashboardHeader fullName={profile.full_name} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <DashboardMainContent activeTab={activeTab} profile={profile} user={user} onProfileUpdate={fetchProfileSafely} />
          </div>
        </div>
      </div>
    </DashboardErrorBoundary>
  );
};

export default StudentDashboardPage;
