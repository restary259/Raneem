import { createFileRoute } from "@tanstack/react-router";
import AgentStudentsPage from "@/pages/agent/AgentStudentsPage";

export const Route = createFileRoute("/agent/students")({
  component: AgentStudentsPage,
});
