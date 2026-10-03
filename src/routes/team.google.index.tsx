import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGoogleBusinessPage from "@/pages/team/TeamGoogleBusinessPage";

export const Route = createFileRoute("/team/google/")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <LegacyGoogleRedirect>
        <TeamGoogleBusinessPage />
      </LegacyGoogleRedirect>
    </GoogleBusinessAccessGate>
  );
}
