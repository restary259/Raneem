import { createFileRoute } from "@tanstack/react-router";
import AdminStudentsPage from "@/pages/admin/AdminStudentsPage";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudentsPage,
});
