import { createFileRoute } from "@tanstack/react-router";
import StudentBagrutPage from "@/pages/student/StudentBagrutPage";

export const Route = createFileRoute("/student/tools/bagrut")({
  component: StudentBagrutPage,
});
