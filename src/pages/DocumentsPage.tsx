
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DocumentsManager from '@/components/dashboard/DocumentsManager';

const DocumentsPage: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Documents & CV</h1>
          <p className="text-gray-600 mt-2">
            Manage your important documents including passport, certificates, and CV
          </p>
        </div>
        
        <DocumentsManager userId={user.id} />
      </div>
    </div>
  );
};

export default DocumentsPage;
