
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ProfileSettings from '@/components/profile/ProfileSettings';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/profile';
import { useToast } from '@/hooks/use-toast';

const ProfileManagementPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "خطأ في تحميل البيانات",
          description: error.message,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, toast]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جار التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">خطأ في تحميل الملف الشخصي</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">إدارة الملف الشخصي</h1>
          <p className="text-gray-600 mt-2">
            إدارة معلوماتك الشخصية وإعدادات الأمان والخصوصية
          </p>
        </div>
        
        <ProfileSettings 
          profile={profile} 
          onProfileUpdate={() => {
            // Refetch profile data
            window.location.reload();
          }} 
        />
      </div>
    </div>
  );
};

export default ProfileManagementPage;
