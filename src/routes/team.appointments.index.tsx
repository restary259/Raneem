import { createFileRoute } from "@tanstack/react-router";
import TeamAppointmentsPage from "@/pages/team/TeamAppointmentsPage";

export const Route = createFileRoute("/team/appointments/")({
  component: TeamAppointmentsPage,
});
