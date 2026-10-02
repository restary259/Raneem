import { createFileRoute } from "@tanstack/react-router";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/team/google/photos")({
  component: TeamGooglePhotosPage,
});
