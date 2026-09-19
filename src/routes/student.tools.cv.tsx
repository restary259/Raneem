import { createFileRoute } from "@tanstack/react-router";
import StudentCvBuilderPage from "@/pages/student/StudentCvBuilderPage";

export const Route = createFileRoute("/student/tools/cv")({
  component: StudentCvBuilderPage,
});
