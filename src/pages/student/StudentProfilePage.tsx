import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import StudentProfile from '@/components/dashboard/StudentProfile';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { Profile, VisaStatus } from '@/types/profile';

export default function StudentProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await (supabase as any)
      .from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) {
      const allowed: VisaStatus[] = ['not_applied', 'applied', 'approved', 'rejected', 'received'];
      setProfile({ ...data, visa_status: allowed.includes(data.visa_status) ? data.visa_status : 'not_applied' });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      fetchProfile(session.user.id);
    });
  }, [navigate, fetchProfile]);

  if (!userId || !profile) return <DashboardLoading />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <StudentProfile profile={profile} userId={userId} onProfileUpdate={fetchProfile} />
    </div>
  );
}
