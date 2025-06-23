
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import CommunicationHub from '@/components/communications/CommunicationHub';
import { Navigate } from 'react-router-dom';

const CommunicationHubPage: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جار التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">مركز التواصل</h1>
          <p className="text-gray-600 mt-2">
            تواصل مع الشركاء والوكلاء واطلع على آخر الإعلانات
          </p>
        </div>
        
        <CommunicationHub userId={user.id} />
      </div>
    </div>
  );
};

export default CommunicationHubPage;
