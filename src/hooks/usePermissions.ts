import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PermissionKey =
  | 'view_cases'
  | 'edit_cases'
  | 'delete_cases'
  | 'assign_cases'
  | 'archive_cases'
  | 'view_students'
  | 'edit_students'
  | 'delete_students'
  | 'view_own_case'
  | 'view_documents'
  | 'upload_documents'
  | 'delete_documents'
  | 'view_finance'
  | 'approve_payments'
  | 'approve_payouts'
  | 'request_payout'
  | 'view_own_earnings'
  | 'export_excel'
  | 'view_reports'
  | 'manage_partners'
  | 'manage_team'
  | 'manage_settings'
  | 'manage_pipeline'
  | 'view_audit_log'
  | 'view_appointments'
  | 'manage_appointments'
  | 'view_referrals'
  | 'manage_referral_links';

/**
 * Permission source of truth lives in the DB (permissions + role_permissions).
 * This hook mirrors it for UI gating only — the server still enforces via RLS.
 */
export function usePermissions() {
  const { user, role, initialized } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_permissions');
    if (!error && Array.isArray(data)) {
      setPermissions(new Set(data as string[]));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!initialized) return;
    load();
  }, [initialized, load, role]);

  const hasPermission = useCallback(
    (key: PermissionKey | PermissionKey[]) => {
      const keys = Array.isArray(key) ? key : [key];
      return keys.some((k) => permissions.has(k));
    },
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (keys: PermissionKey[]) => keys.every((k) => permissions.has(k)),
    [permissions]
  );

  return { permissions, hasPermission, hasAllPermissions, loading, refresh: load };
}
