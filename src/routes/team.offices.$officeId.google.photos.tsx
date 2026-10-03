import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/team/offices/$officeId/google/photos")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="team"
      officeId={officeId}
      googleTab="photos"
    >
      <TeamGooglePhotosPage />
    </OfficeWorkspaceLayout>
  );
}
