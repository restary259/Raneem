import { createFileRoute } from "@tanstack/react-router";
import AgentSettingsPage from "@/pages/agent/AgentSettingsPage";

export const Route = createFileRoute("/agent/profile")({
  component: AgentSettingsPage,
});
