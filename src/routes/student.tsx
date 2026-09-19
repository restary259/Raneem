import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import StudentOnboardingGate from "@/components/student/StudentOnboardingGate";
import DashboardLayout from "@/components/layout/DashboardLayout";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

function StudentLayout() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <StudentOnboardingGate>
        <DashboardLayout role="student" />
      </StudentOnboardingGate>
    </ProtectedRoute>
  );
}
