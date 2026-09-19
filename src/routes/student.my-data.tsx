import { createFileRoute } from "@tanstack/react-router";
import StudentDataPage from "@/pages/student/StudentDataPage";

export const Route = createFileRoute("/student/my-data")({
  component: StudentDataPage,
});
