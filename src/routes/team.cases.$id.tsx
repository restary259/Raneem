import { createFileRoute } from "@tanstack/react-router";
import CaseDetailPage from "@/pages/team/CaseDetailPage";

export const Route = createFileRoute("/team/cases/$id")({
  component: CaseDetailPage,
});
