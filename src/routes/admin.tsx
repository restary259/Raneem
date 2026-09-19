import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout role="admin" />
    </ProtectedRoute>
  );
}
