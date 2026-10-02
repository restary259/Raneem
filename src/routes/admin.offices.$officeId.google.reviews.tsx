import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleReviewsPage from "@/pages/team/TeamGoogleReviewsPage";

export const Route = createFileRoute("/admin/offices/$officeId/google/reviews")(
  {
    component: GoogleRoute,
  },
);

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="admin"
      officeId={officeId}
      googleTab="reviews"
    >
      <TeamGoogleReviewsPage />
    </OfficeWorkspaceLayout>
  );
}
