import { createFileRoute } from "@tanstack/react-router";
import StudentVisaPage from "@/pages/student/StudentVisaPage";

export const Route = createFileRoute("/student/visa")({
  component: StudentVisaPage,
});
