import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import ReferralForm from '@/components/dashboard/ReferralForm';
import ReferralTracker from '@/components/dashboard/ReferralTracker';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentReferPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <ReferralForm userId={userId} />
      <ReferralTracker userId={userId} />
    </div>
  );
}
