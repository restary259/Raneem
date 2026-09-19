import { createFileRoute } from "@tanstack/react-router";
import AdminActivityPage from "@/pages/admin/AdminActivityPage";

export const Route = createFileRoute("/admin/activity")({
  component: AdminActivityPage,
});
