import { createFileRoute } from "@tanstack/react-router";
import StudentContactsPage from "@/pages/student/StudentContactsPage";

export const Route = createFileRoute("/student/contacts")({
  component: StudentContactsPage,
});
