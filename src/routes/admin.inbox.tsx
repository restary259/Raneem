import { createFileRoute } from "@tanstack/react-router";
import AdminInboxPage from "@/pages/admin/AdminInboxPage";

export const Route = createFileRoute("/admin/inbox")({
  component: AdminInboxPage,
});
