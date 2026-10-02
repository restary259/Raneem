import { createFileRoute } from "@tanstack/react-router";
import GoogleBusinessAccessGate from "@/components/auth/GoogleBusinessAccessGate";
import TeamGoogleReviewsPage from "@/pages/team/TeamGoogleReviewsPage";

export const Route = createFileRoute("/team/google/reviews")({
  component: TeamGoogleRoute,
});

function TeamGoogleRoute() {
  return (
    <GoogleBusinessAccessGate>
      <TeamGoogleReviewsPage />
    </GoogleBusinessAccessGate>
  );
}
