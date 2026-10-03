import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import OfficeOverviewPage from "@/pages/shared/OfficeOverviewPage";

export const Route = createFileRoute("/team/offices/$officeId/")({
  component: OfficeOverviewRoute,
});

function OfficeOverviewRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="team" officeId={officeId}>
      <OfficeOverviewPage surface="team" />
    </OfficeWorkspaceLayout>
  );
}
