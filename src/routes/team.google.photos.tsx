import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/team/google/photos")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <TeamGooglePhotosPage />
    </GoogleBusinessAccessGate>
  );
}
