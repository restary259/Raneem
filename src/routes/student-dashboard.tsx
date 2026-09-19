import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/student-dashboard")({
  component: () => <Navigate to="/student/checklist" replace />,
});
