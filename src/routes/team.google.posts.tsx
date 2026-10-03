import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/google/posts")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <LegacyGoogleRedirect tab="posts">
        <TeamGooglePostsPage />
      </LegacyGoogleRedirect>
    </GoogleBusinessAccessGate>
  );
}
