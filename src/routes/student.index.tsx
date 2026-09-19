import { createFileRoute } from "@tanstack/react-router";
import StudentNextStepsPage from "@/pages/student/StudentNextStepsPage";

export const Route = createFileRoute("/student/")({
  component: StudentNextStepsPage,
});
