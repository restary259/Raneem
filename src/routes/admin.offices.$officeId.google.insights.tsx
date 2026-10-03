import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleInsightsPage from "@/pages/team/TeamGoogleInsightsPage";

export const Route = createFileRoute(
  "/admin/offices/$officeId/google/insights",
)({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="admin"
      officeId={officeId}
      googleTab="insights"
    >
      <TeamGoogleInsightsPage />
    </OfficeWorkspaceLayout>
  );
}
