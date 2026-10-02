import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import TeamGoogleInsightsPage from "@/pages/team/TeamGoogleInsightsPage";

export const Route = createFileRoute("/team/google/insights")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <TeamGoogleInsightsPage />
    </GoogleBusinessAccessGate>
  );
}
