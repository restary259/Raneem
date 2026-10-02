import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/google/posts")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect tab="posts">
      <TeamGooglePostsPage />
    </LegacyGoogleRedirect>
  );
}
