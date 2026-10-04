import React from 'react';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import DocumentsManager from '@/components/dashboard/DocumentsManager';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import StudentPaymentProofsList from '@/components/student/StudentPaymentProofsList';

export default function StudentDocumentsPage() {
  const userId = useAuthedUserId();

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <DocumentsManager userId={userId} />
      <StudentPaymentProofsList />
    </div>
  );
}
