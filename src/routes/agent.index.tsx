import { createFileRoute } from "@tanstack/react-router";
import AgentOverviewPage from "@/pages/agent/AgentOverviewPage";

export const Route = createFileRoute("/agent/")({
  component: AgentOverviewPage,
});
