
import React from 'react';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/profile';
import StudentProfile from '@/components/dashboard/StudentProfile';
import ServicesOverview from '@/components/dashboard/ServicesOverview';
import PaymentsSummary from '@/components/dashboard/PaymentsSummary';
import DocumentsManager from '@/components/dashboard/DocumentsManager';

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
      case 'services':
        return <ServicesOverview userId={user.id} />;
      case 'payments':
        return <PaymentsSummary userId={user.id} />;
      case 'documents':
        return <DocumentsManager userId={user.id} />;
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
