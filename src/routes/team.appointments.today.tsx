import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/team/appointments/today")({
  component: () => <Navigate to="/team" replace />,
});
