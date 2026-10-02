import { createFileRoute } from "@tanstack/react-router";
import TeamGooglePostsPage from "@/pages/team/TeamGooglePostsPage";

export const Route = createFileRoute("/team/google/posts")({
  component: TeamGooglePostsPage,
});
