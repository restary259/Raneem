import { createFileRoute } from "@tanstack/react-router";
import TeamGoogleProfilePage from "@/pages/team/TeamGoogleProfilePage";

export const Route = createFileRoute("/team/google/profile")({
  component: TeamGoogleProfilePage,
});
