import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PartnerDashboardLayout from "@/components/layout/PartnerDashboardLayout";

export const Route = createFileRoute("/partner")({
  component: PartnerLayout,
});

function PartnerLayout() {
  return (
    <ProtectedRoute allowedRoles={["social_media_partner", "ambassador"]}>
      <PartnerDashboardLayout />
    </ProtectedRoute>
  );
}
