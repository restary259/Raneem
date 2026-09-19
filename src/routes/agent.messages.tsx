import { createFileRoute } from "@tanstack/react-router";
import AgentMessagesPage from "@/pages/agent/AgentMessagesPage";

export const Route = createFileRoute("/agent/messages")({
  component: AgentMessagesPage,
});
