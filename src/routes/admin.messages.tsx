import { createFileRoute } from "@tanstack/react-router";
import TeamInboxPage from "@/pages/messages/TeamInboxPage";

export const Route = createFileRoute("/admin/messages")({
  component: TeamInboxPage,
});
