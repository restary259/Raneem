import { createFileRoute } from "@tanstack/react-router";
import TeamCurrencyPage from "@/pages/team/TeamCurrencyPage";

export const Route = createFileRoute("/team/tools/currency")({
  component: TeamCurrencyPage,
});
