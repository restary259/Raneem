import { createFileRoute } from "@tanstack/react-router";
import TeamGoogleReviewsPage from "@/pages/team/TeamGoogleReviewsPage";

export const Route = createFileRoute("/team/google/reviews")({
  component: TeamGoogleReviewsPage,
});
