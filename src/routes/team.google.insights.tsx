import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGoogleInsightsPage from "@/pages/team/TeamGoogleInsightsPage";

export const Route = createFileRoute("/team/google/insights")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect tab="insights">
      <TeamGoogleInsightsPage />
    </LegacyGoogleRedirect>
  );
}
