import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/agent/analytics")({
  component: () => <Navigate to="/agent/network?tab=performance" replace />,
});
