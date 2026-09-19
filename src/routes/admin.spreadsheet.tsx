import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin/spreadsheet")({
  component: () => <Navigate to="/admin/financials?tab=spreadsheet" replace />,
});
