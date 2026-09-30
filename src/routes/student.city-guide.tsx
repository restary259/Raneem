import { createFileRoute } from "@tanstack/react-router";
import StudentCityGuidePage from "@/pages/student/StudentCityGuidePage";

export const Route = createFileRoute("/student/city-guide")({
  component: StudentCityGuidePage,
});
