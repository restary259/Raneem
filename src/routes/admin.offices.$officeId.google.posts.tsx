import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/admin/offices/$officeId/google/posts")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="admin"
      officeId={officeId}
      googleTab="posts"
    >
      <TeamGooglePostsPage />
    </OfficeWorkspaceLayout>
  );
}
