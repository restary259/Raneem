import { createFileRoute } from "@tanstack/react-router";
import AgentNetworkHubPage from "@/pages/agent/AgentNetworkHubPage";

export const Route = createFileRoute("/agent/network")({
  component: AgentNetworkHubPage,
});
