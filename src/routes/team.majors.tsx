import { createFileRoute } from "@tanstack/react-router";
import TeamMajorIntelPage from "@/pages/team/TeamMajorIntelPage";

export const Route = createFileRoute("/team/majors")({
  component: TeamMajorIntelPage,
});
