import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy AdminDashboardPage — redirects to the new command center.
 * Auth + security gate is handled by ProtectedRoute in App.tsx.
 */
const AdminDashboardPage = () => {
  return <Navigate to="/admin" replace />;
};

export default AdminDashboardPage;
