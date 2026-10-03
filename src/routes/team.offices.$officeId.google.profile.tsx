import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleProfilePage from "@/pages/team/TeamGoogleProfilePage";

export const Route = createFileRoute("/team/offices/$officeId/google/profile")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="team"
      officeId={officeId}
      googleTab="profile"
    >
      <TeamGoogleProfilePage />
    </OfficeWorkspaceLayout>
  );
}
