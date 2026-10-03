import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleInsightsPage from "@/pages/team/TeamGoogleInsightsPage";

export const Route = createFileRoute("/team/offices/$officeId/google/insights")(
  {
    component: GoogleRoute,
  },
);

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <GoogleBusinessAccessGate redirectTo="/team/offices">
      <OfficeWorkspaceLayout
        surface="team"
        officeId={officeId}
        googleTab="insights"
      >
        <TeamGoogleInsightsPage />
      </OfficeWorkspaceLayout>
    </GoogleBusinessAccessGate>
  );
}
