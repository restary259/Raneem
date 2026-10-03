import { createFileRoute } from "@tanstack/react-router";
import { OfficeWorkspaceLayout } from "@/components/office/OfficeWorkspaceLayout";
import TeamGoogleReviewsPage from "@/pages/team/TeamGoogleReviewsPage";

export const Route = createFileRoute("/team/offices/$officeId/google/reviews")({
  component: GoogleRoute,
});

function GoogleRoute() {
  const { officeId } = Route.useParams();
  return (
    <OfficeWorkspaceLayout
      surface="team"
      officeId={officeId}
      googleTab="reviews"
    >
      <TeamGoogleReviewsPage />
    </OfficeWorkspaceLayout>
  );
}
