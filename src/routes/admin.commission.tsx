import { createFileRoute } from "@tanstack/react-router";
import AdminCommissionHubPage from "@/pages/admin/AdminCommissionHubPage";

export const Route = createFileRoute("/admin/commission")({
  component: AdminCommissionHubPage,
});
