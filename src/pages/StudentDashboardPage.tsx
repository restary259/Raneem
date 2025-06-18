
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

const StudentDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/student-auth');
        return;
      }
      setUser(session.user);
      await fetchProfile(session.user.id);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate('/student-auth');
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Safely cast visa_status:
      const allowedStatuses: VisaStatus[] = [
        'not_applied', 'applied', 'approved', 'rejected', 'received'
      ];
      const safeProfile: Profile = {
        ...data,
        visa_status: allowedStatuses.includes(data.visa_status) ? data.visa_status : undefined,
      };

      setProfile(safeProfile);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        variant: "destructive",
        title: "خطأ في تحميل البيانات",
        description: "حدث خطأ أثناء تحميل بياناتك",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (!user || !profile) {
    return null;
  }

  return (
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
            onProfileUpdate={fetchProfile}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
