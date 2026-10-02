import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/google/posts")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <TeamGooglePostsPage />
    </GoogleBusinessAccessGate>
  );
}
