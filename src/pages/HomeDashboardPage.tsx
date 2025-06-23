
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import HomeFeed from '@/components/feed/HomeFeed';

const HomeDashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جار التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/student-auth" />;
  }

  return <HomeFeed />;
};

export default HomeDashboardPage;
