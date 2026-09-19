import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/agent/recruit")({
  component: () => <Navigate to="/agent/network?tab=recruit" replace />,
});
