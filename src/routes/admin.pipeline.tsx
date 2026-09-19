import { createFileRoute } from "@tanstack/react-router";
import AdminPipelineHubPage from "@/pages/admin/AdminPipelineHubPage";

export const Route = createFileRoute("/admin/pipeline")({
  component: AdminPipelineHubPage,
});
