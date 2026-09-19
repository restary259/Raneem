import { createFileRoute } from "@tanstack/react-router";
import TeamStudentProfilePage from "@/pages/team/TeamStudentProfilePage";

export const Route = createFileRoute("/team/students/$id")({
  component: TeamStudentProfilePage,
});
