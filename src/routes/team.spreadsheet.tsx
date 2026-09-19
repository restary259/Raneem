import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/team/spreadsheet")({
  component: () => <Navigate to="/team/analytics?tab=spreadsheet" replace />,
});
