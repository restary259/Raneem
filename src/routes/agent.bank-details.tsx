import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/agent/bank-details")({
  component: () => <Navigate to="/agent/earnings?tab=bank" replace />,
});
