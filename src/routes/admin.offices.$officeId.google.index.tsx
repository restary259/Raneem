import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleBusinessPage from "@/pages/team/TeamGoogleBusinessPage";

export const Route = createFileRoute("/admin/offices/$officeId/google/")({
  component: GoogleOverviewRoute,
});

function GoogleOverviewRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="admin" officeId={officeId} googleTab="">
      <TeamGoogleBusinessPage />
    </OfficeWorkspaceLayout>
  );
}
