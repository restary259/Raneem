import { createFileRoute } from "@tanstack/react-router";
import TeamReportsPage from "@/pages/team/TeamReportsPage";

export const Route = createFileRoute("/team/analytics")({
  component: TeamReportsPage,
});
