import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import OfficeOverviewPage from "@/pages/shared/OfficeOverviewPage";

export const Route = createFileRoute("/admin/offices/$officeId/")({
  component: OfficeOverviewRoute,
});

function OfficeOverviewRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="admin" officeId={officeId}>
      <OfficeOverviewPage surface="admin" />
    </OfficeWorkspaceLayout>
  );
}
