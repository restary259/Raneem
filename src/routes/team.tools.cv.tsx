import { createFileRoute } from "@tanstack/react-router";
import TeamCvBuilderPage from "@/pages/team/TeamCvBuilderPage";

export const Route = createFileRoute("/team/tools/cv")({
  component: TeamCvBuilderPage,
});
