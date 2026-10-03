import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import OfficeTeamPage from "@/pages/shared/OfficeTeamPage";

export const Route = createFileRoute("/team/offices/$officeId/team")({
  component: OfficeTeamRoute,
});

function OfficeTeamRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="team" officeId={officeId}>
      <OfficeTeamPage />
    </OfficeWorkspaceLayout>
  );
}
