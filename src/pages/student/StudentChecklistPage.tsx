import React from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import ChecklistTracker from '@/components/dashboard/ChecklistTracker';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentChecklistPage() {
  const userId = useAuthedUserId();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <ChecklistTracker userId={userId} />
    </div>
  );
}
