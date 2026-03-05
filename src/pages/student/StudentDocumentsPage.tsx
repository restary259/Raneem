import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import DocumentsManager from '@/components/dashboard/DocumentsManager';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentDocumentsPage() {
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
    <div className="p-6 max-w-4xl mx-auto">
      <DocumentsManager userId={userId} />
    </div>
  );
}
