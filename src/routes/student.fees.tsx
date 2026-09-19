import { createFileRoute } from "@tanstack/react-router";
import StudentFeesPage from "@/pages/student/StudentFeesPage";

export const Route = createFileRoute("/student/fees")({
  component: StudentFeesPage,
});
