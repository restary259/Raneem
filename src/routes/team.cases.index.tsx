import { createFileRoute } from "@tanstack/react-router";
import TeamCasesHubPage from "@/pages/team/TeamCasesHubPage";

export const Route = createFileRoute("/team/cases/")({
  component: TeamCasesHubPage,
});
