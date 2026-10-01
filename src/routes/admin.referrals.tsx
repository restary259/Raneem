import { createFileRoute } from "@tanstack/react-router";
import AdminReferralOperationsPage from "@/pages/admin/AdminReferralOperationsPage";

export const Route = createFileRoute("/admin/referrals")({
  component: AdminReferralOperationsPage,
});
