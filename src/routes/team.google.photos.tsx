import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGooglePhotosPage from "@/pages/team/TeamGooglePhotosPage";

export const Route = createFileRoute("/team/google/photos")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect tab="photos">
      <TeamGooglePhotosPage />
    </LegacyGoogleRedirect>
  );
}
