import { createFileRoute } from "@tanstack/react-router";
import AgentEarningsHubPage from "@/pages/agent/AgentEarningsHubPage";

export const Route = createFileRoute("/agent/earnings")({
  component: AgentEarningsHubPage,
});
