import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/team/students/")({
  component: () => <Navigate to="/team/cases?tab=students" replace />,
});
