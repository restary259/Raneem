import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGoogleBusinessPage from "@/pages/team/TeamGoogleBusinessPage";

export const Route = createFileRoute("/team/google/")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect>
      <TeamGoogleBusinessPage />
    </LegacyGoogleRedirect>
  );
}
