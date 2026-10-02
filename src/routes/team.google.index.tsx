import { createFileRoute } from "@tanstack/react-router";
import TeamGoogleBusinessPage from "@/pages/team/TeamGoogleBusinessPage";

export const Route = createFileRoute("/team/google")({
  component: TeamGoogleBusinessPage,
});
