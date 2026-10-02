import { createFileRoute } from "@tanstack/react-router";
import TeamGoogleInsightsPage from "@/pages/team/TeamGoogleInsightsPage";

export const Route = createFileRoute("/team/google/insights")({
  component: TeamGoogleInsightsPage,
});
