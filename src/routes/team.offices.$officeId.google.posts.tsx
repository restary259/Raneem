import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/offices/$officeId/google/posts")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <GoogleBusinessAccessGate redirectTo="/team/offices">
      <OfficeWorkspaceLayout
        surface="team"
        officeId={officeId}
        googleTab="posts"
      >
        <TeamGooglePostsPage />
      </OfficeWorkspaceLayout>
    </GoogleBusinessAccessGate>
  );
}
