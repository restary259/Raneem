import { createFileRoute, redirect } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/team")({
  ssr: false,
  // Early sign-in check so team page code isn't loaded for signed-out visitors.
  // Role checks stay in ProtectedRoute (and RLS).
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/student-auth", replace: true });
  },
  component: TeamLayout,
});

function TeamLayout() {
  return (
    <ProtectedRoute allowedRoles={["team_member"]}>
      <DashboardLayout role="team_member" />
    </ProtectedRoute>
  );
}
