import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin/analytics")({
  component: () => <Navigate to="/admin/financials?tab=analytics" replace />,
});
