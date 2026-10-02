import { createFileRoute } from "@tanstack/react-router";
import AdminGoogleIntegrationPage from "@/pages/admin/AdminGoogleIntegrationPage";

export const Route = createFileRoute("/admin/google")({
  component: AdminGoogleIntegrationPage,
});
