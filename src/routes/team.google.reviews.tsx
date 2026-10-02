import { createFileRoute } from "@tanstack/react-router";
import LegacyGoogleRedirect from "@/pages/team/LegacyGoogleRedirect";
import TeamGoogleReviewsPage from "@/pages/team/TeamGoogleReviewsPage";

export const Route = createFileRoute("/team/google/reviews")({
  component: LegacyGoogleRoute,
});

function LegacyGoogleRoute() {
  return (
    <LegacyGoogleRedirect tab="reviews">
      <TeamGoogleReviewsPage />
    </LegacyGoogleRedirect>
  );
}
