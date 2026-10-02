import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import TeamGoogleProfilePage from "@/pages/team/TeamGoogleProfilePage";

export const Route = createFileRoute("/team/google/profile")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <TeamGoogleProfilePage />
    </GoogleBusinessAccessGate>
  );
}
