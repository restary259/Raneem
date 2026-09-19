import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin/team")({
  component: () => <Navigate to="/admin/members?tab=team" replace />,
});
