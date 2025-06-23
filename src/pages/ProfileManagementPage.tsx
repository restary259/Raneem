
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ProfileSettings from '@/components/profile/ProfileSettings';
import SimpleProfileEditor from '@/components/profile/SimpleProfileEditor';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/profile';
import { useToast } from '@/hooks/use-toast';

const ProfileManagementPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        setProfile(data);
        
        // If no profile exists, start in editing mode
        if (!data) {
          setIsEditing(true);
        }
      } catch (error: any) {
        console.error('Error fetching profile:', error);
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

  const handleProfileUpdate = () => {
    // Refetch profile data
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error && error.code !== 'PGRST116') {
            console.error('Error refetching profile:', error);
          } else {
            setProfile(data);
            setIsEditing(false);
          }
        });
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">إدارة الملف الشخصي</h1>
          <p className="text-gray-600 mt-2">
            إدارة معلوماتك الشخصية وإعدادات الأمان والخصوصية
          </p>
        </div>
        
        {isEditing || !profile ? (
          <SimpleProfileEditor
            profile={profile}
            userId={user.id}
            onSave={handleProfileUpdate}
            onCancel={() => {
              if (profile) {
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                تعديل الملف الشخصي
              </button>
            </div>
            <ProfileSettings 
              profile={profile} 
              onProfileUpdate={handleProfileUpdate} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileManagementPage;
