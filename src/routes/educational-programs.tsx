import { createFileRoute } from "@tanstack/react-router";
import EducationalProgramsPage from "@/pages/EducationalProgramsPage";

export const Route = createFileRoute("/educational-programs")({
  component: EducationalProgramsPage,
});
