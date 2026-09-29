import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin/visa")({
  component: () => <Navigate to="/admin/pipeline?tab=visa" replace />,
});
