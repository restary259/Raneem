import { createFileRoute } from "@tanstack/react-router";
import OfficeDirectoryPage from "@/pages/shared/OfficeDirectoryPage";

export const Route = createFileRoute("/team/offices/")({
  component: () => <OfficeDirectoryPage surface="team" />,
});
