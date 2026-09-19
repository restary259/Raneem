import { createFileRoute } from "@tanstack/react-router";
import TeamPartnerSchoolsCountryPage from "@/pages/team/TeamPartnerSchoolsCountryPage";

export const Route = createFileRoute("/team/partner-schools/$country/")({
  component: TeamPartnerSchoolsCountryPage,
});
