import React from 'react';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import DocumentsManager from '@/components/dashboard/DocumentsManager';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentDocumentsPage() {
  const userId = useAuthedUserId();

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <DocumentsManager userId={userId} />
    </div>
  );
}
