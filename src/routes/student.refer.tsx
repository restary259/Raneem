import { createFileRoute } from "@tanstack/react-router";
import StudentReferPage from "@/pages/student/StudentReferPage";

export const Route = createFileRoute("/student/refer")({
  component: StudentReferPage,
});
