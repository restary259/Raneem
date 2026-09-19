import { createFileRoute } from "@tanstack/react-router";
import PartnerMessagesPage from "@/pages/messages/PartnerMessagesPage";

export const Route = createFileRoute("/partner/messages")({
  component: PartnerMessagesPage,
});
