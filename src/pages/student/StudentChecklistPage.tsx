import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import ChecklistTracker from '@/components/dashboard/ChecklistTracker';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentChecklistPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <ChecklistTracker userId={userId} />
    </div>
  );
}
