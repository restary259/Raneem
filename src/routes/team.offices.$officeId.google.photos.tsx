import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/team/offices/$officeId/google/photos")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <GoogleBusinessAccessGate redirectTo="/team/offices">
      <OfficeWorkspaceLayout
        surface="team"
        officeId={officeId}
        googleTab="photos"
      >
        <TeamGooglePhotosPage />
      </OfficeWorkspaceLayout>
    </GoogleBusinessAccessGate>
  );
}
