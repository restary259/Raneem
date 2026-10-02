import { createFileRoute } from "@tanstack/react-router";
import AdminOfficesPage from "@/pages/admin/AdminOfficesPage";

export const Route = createFileRoute("/admin/offices/")({
  component: AdminOfficesPage,
});
