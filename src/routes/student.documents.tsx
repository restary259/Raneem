import { createFileRoute } from "@tanstack/react-router";
import StudentDocumentsPage from "@/pages/student/StudentDocumentsPage";

export const Route = createFileRoute("/student/documents")({
  component: StudentDocumentsPage,
});
