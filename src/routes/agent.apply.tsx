import { createFileRoute } from "@tanstack/react-router";
import AgentApplyPage from "@/pages/agent/AgentApplyPage";

export const Route = createFileRoute("/agent/apply")({
  component: AgentApplyPage,
});
