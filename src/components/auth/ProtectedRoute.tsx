import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import AdminSecurityGate from '@/components/admin/AdminSecurityGate';
import ForcePasswordChange from '@/components/auth/ForcePasswordChange';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { initialized, user, role, mustChangePassword, refreshRole } = useAuth();
  const location = useLocation();
  const [adminCleared, setAdminCleared] = useState(false);
  const [passwordCleared, setPasswordCleared] = useState(false);

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

  // Temporary password still in place (admins handle this inside their own gate):
  // block every dashboard route until a strong password is set and confirmed.
  if (mustChangePassword && role !== 'admin' && !passwordCleared) {
    return (
      <ForcePasswordChange
        userId={user.id}
        onDone={() => {
          setPasswordCleared(true);
          refreshRole();
        }}
      />
    );
  }

  // Role not yet loaded or not authorized
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/student-auth" replace />;
  }


  // Admin: must pass security gate (TOTP 2FA) before accessing dashboard
  if (role === 'admin' && !adminCleared) {
    return (
      <AdminSecurityGate
        userId={user.id}
        onCleared={() => setAdminCleared(true)}
      />
    );
  }

  return <>{children}</>;
}
