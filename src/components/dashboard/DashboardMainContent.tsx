
import React from 'react';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/profile';
import StudentProfile from '@/components/dashboard/StudentProfile';
import DocumentsManager from '@/components/dashboard/DocumentsManager';
import ChecklistTracker from '@/components/dashboard/ChecklistTracker';
import ReferralForm from '@/components/dashboard/ReferralForm';
import RewardsPanel from '@/components/dashboard/RewardsPanel';
import MyApplicationTab from '@/components/dashboard/MyApplicationTab';

interface DashboardMainContentProps {
  activeTab: string;
  profile: Profile;
  user: User;
  onProfileUpdate: (userId: string) => void;
}

const DashboardMainContent: React.FC<DashboardMainContentProps> = ({
  activeTab,
  profile,
  user,
  onProfileUpdate
}) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <StudentProfile 
            profile={profile} 
            onProfileUpdate={onProfileUpdate}
            userId={user.id}
          />
        );
      case 'application':
        return <MyApplicationTab userId={user.id} />;
      case 'checklist':
        return <ChecklistTracker userId={user.id} />;
      case 'documents':
        return <DocumentsManager userId={user.id} />;
      case 'referrals':
        return <ReferralForm userId={user.id} />;
      case 'rewards':
        return <RewardsPanel userId={user.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1">
      {renderContent()}
    </div>
  );
};

export default DashboardMainContent;
