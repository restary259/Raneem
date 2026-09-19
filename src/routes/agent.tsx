import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AgentDashboardLayout from "@/components/layout/AgentDashboardLayout";

export const Route = createFileRoute("/agent")({
  component: AgentLayout,
});

function AgentLayout() {
  return (
    <ProtectedRoute allowedRoles={["agent"]}>
      <AgentDashboardLayout />
    </ProtectedRoute>
  );
}
