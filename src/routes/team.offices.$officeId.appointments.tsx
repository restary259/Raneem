import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamAppointmentsPage from "@/pages/team/TeamAppointmentsPage";

export const Route = createFileRoute("/team/offices/$officeId/appointments")({
  component: OfficeAppointmentsRoute,
});

function OfficeAppointmentsRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="team" officeId={officeId}>
      <TeamAppointmentsPage />
    </OfficeWorkspaceLayout>
  );
}
