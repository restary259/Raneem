import React from 'react';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import ReferralForm from '@/components/dashboard/ReferralForm';
import ReferralTracker from '@/components/dashboard/ReferralTracker';
import ReferralLinkCard from '@/components/dashboard/ReferralLinkCard';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

export default function StudentReferPage() {
  const userId = useAuthedUserId();

  if (!userId) return <DashboardLoading />;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <ReferralLinkCard userId={userId} />
      <ReferralForm userId={userId} />
      <ReferralTracker userId={userId} />
    </div>
  );
}
