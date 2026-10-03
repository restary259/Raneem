import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGoogleProfilePage from "@/pages/team/TeamGoogleProfilePage";

export const Route = createFileRoute("/team/google/profile")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect tab="profile">
      <TeamGoogleProfilePage />
    </LegacyGoogleRedirect>
  );
}
