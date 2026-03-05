import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import AdminSecurityGate from '@/components/admin/AdminSecurityGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { initialized, user, role, mustChangePassword } = useAuth();
  const location = useLocation();

  // Wait for auth to initialize
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/student-auth" state={{ from: location }} replace />;
  }

  // Must change password
  if (mustChangePassword) {
    return <Navigate to="/student-auth?action=change-password" replace />;
  }

  // Role not yet loaded or not authorized
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/student-auth" replace />;
  }

  // Wrap admin routes with security gate (TOTP 2FA)
  if (role === 'admin') {
    return (
      <AdminSecurityGate userId={user.id} onCleared={() => {}}>
        {children}
      </AdminSecurityGate>
    );
  }

  return <>{children}</>;
}
