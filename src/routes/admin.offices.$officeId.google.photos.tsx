import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/admin/offices/$officeId/google/photos")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="admin"
      officeId={officeId}
      googleTab="photos"
    >
      <TeamGooglePhotosPage />
    </OfficeWorkspaceLayout>
  );
}
