import { createFileRoute } from "@tanstack/react-router";
import TeamPartnerSchoolsPage from "@/pages/team/TeamPartnerSchoolsPage";

export const Route = createFileRoute("/team/partner-schools/")({
  component: TeamPartnerSchoolsPage,
});
