import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/team")({
  component: TeamLayout,
});

function TeamLayout() {
  return (
    <ProtectedRoute allowedRoles={["team_member"]}>
      <DashboardLayout role="team_member" />
    </ProtectedRoute>
  );
}
