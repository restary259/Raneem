import { createFileRoute } from "@tanstack/react-router";
import TeamAppointmentsPage from "@/pages/team/TeamAppointmentsPage";

export const Route = createFileRoute("/team/appointments/")({
  // `?appointment=<id>` deep-links an appointment reminder push straight to the
  // exact appointment instead of the generic board.
  validateSearch: (search: Record<string, unknown>) => ({
    appointment: typeof search.appointment === "string" ? search.appointment : "",
  }),
  component: TeamAppointmentsPage,
});
