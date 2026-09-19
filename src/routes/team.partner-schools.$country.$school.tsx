import { createFileRoute } from "@tanstack/react-router";
import TeamPartnerSchoolPage from "@/pages/team/TeamPartnerSchoolPage";

export const Route = createFileRoute("/team/partner-schools/$country/$school")({
  component: TeamPartnerSchoolPage,
});
