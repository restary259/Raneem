import { createFileRoute } from "@tanstack/react-router";
import AdminCommandCenter from "@/pages/admin/AdminCommandCenter";

export const Route = createFileRoute("/admin/")({
  component: AdminCommandCenter,
});
