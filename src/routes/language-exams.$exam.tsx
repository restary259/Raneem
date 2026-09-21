import { createFileRoute } from "@tanstack/react-router";
import ExamDetailPage from "@/pages/ExamDetailPage";

export const Route = createFileRoute("/language-exams/$exam")({
  component: ExamDetailPage,
});
