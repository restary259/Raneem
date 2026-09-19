import { createFileRoute } from "@tanstack/react-router";
import AdminFinanceHubPage from "@/pages/admin/AdminFinanceHubPage";

export const Route = createFileRoute("/admin/financials")({
  component: AdminFinanceHubPage,
});
