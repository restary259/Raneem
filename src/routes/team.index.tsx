import { createFileRoute } from "@tanstack/react-router";
import TeamWorkPage from "@/pages/team/TeamWorkPage";

export const Route = createFileRoute("/team/")({
  component: TeamWorkPage,
});
