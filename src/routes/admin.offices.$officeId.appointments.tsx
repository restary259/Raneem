import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamAppointmentsPage from "@/pages/team/TeamAppointmentsPage";

export const Route = createFileRoute("/admin/offices/$officeId/appointments")({
  component: OfficeAppointmentsRoute,
});

function OfficeAppointmentsRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="admin" officeId={officeId}>
      <TeamAppointmentsPage />
    </OfficeWorkspaceLayout>
  );
}
