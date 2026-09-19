import { createFileRoute } from "@tanstack/react-router";
import StudentChecklistPage from "@/pages/student/StudentChecklistPage";

export const Route = createFileRoute("/student/checklist")({
  component: StudentChecklistPage,
});
