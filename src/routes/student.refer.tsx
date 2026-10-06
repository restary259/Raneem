import { createFileRoute, redirect } from "@tanstack/react-router";
import StudentReferPage from "@/pages/student/StudentReferPage";

// Refer page temporarily hidden from students; direct visits go to the dashboard.
export const Route = createFileRoute("/student/refer")({
  beforeLoad: () => {
    throw redirect({ to: "/student" });
  },
  component: StudentReferPage,
});
