import { createFileRoute } from "@tanstack/react-router";
import AdminMembersPage from "@/pages/admin/AdminMembersPage";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembersPage,
});
