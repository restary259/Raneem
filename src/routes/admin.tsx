import { createFileRoute, redirect } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  // Early sign-in check so admin page code isn't loaded for signed-out visitors.
  // Role/AAL2 checks stay in ProtectedRoute + AdminSecurityGate (and RLS).
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.href } as never });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout role="admin" />
    </ProtectedRoute>
  );
}
