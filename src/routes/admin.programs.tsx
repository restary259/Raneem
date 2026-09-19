import { createFileRoute } from "@tanstack/react-router";
import AdminProgramsPage from "@/pages/admin/AdminProgramsPage";

export const Route = createFileRoute("/admin/programs")({
  component: AdminProgramsPage,
});
