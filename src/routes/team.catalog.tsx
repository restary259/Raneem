import { createFileRoute } from "@tanstack/react-router";
import TeamCatalogPage from "@/pages/team/TeamCatalogPage";

export const Route = createFileRoute("/team/catalog")({
  component: TeamCatalogPage,
});
