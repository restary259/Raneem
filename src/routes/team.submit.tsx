import { createFileRoute } from "@tanstack/react-router";
import SubmitNewStudentPage from "@/pages/team/SubmitNewStudentPage";

export const Route = createFileRoute("/team/submit")({
  component: SubmitNewStudentPage,
});
