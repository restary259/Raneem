import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/offices/$officeId/google/posts")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout surface="team" officeId={officeId} googleTab="posts">
      <TeamGooglePostsPage />
    </OfficeWorkspaceLayout>
  );
}
