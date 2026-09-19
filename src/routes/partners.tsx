import { createFileRoute } from "@tanstack/react-router";
import EducationalDestinationsPage from "@/pages/EducationalDestinationsPage";

export const Route = createFileRoute("/partners")({
  component: EducationalDestinationsPage,
});
