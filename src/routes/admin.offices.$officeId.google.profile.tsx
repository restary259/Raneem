import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleProfilePage from "@/pages/team/TeamGoogleProfilePage";

export const Route = createFileRoute("/admin/offices/$officeId/google/profile")(
  {
    component: GoogleRoute,
  },
);

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="admin"
      officeId={officeId}
      googleTab="profile"
    >
      <TeamGoogleProfilePage />
    </OfficeWorkspaceLayout>
  );
}
