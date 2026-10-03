import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleBusinessPage from "@/pages/team/TeamGoogleBusinessPage";

export const Route = createFileRoute("/team/offices/$officeId/google/")({
  component: GoogleOverviewRoute,
});

function GoogleOverviewRoute() {
  const { officeId } = Route.useParams();
  return (
    <GoogleBusinessAccessGate redirectTo="/team/offices">
      <OfficeWorkspaceLayout surface="team" officeId={officeId} googleTab="">
        <TeamGoogleBusinessPage />
      </OfficeWorkspaceLayout>
    </GoogleBusinessAccessGate>
  );
}
