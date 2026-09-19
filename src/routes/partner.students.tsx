import { createFileRoute } from "@tanstack/react-router";
import PartnerStudentsPage from "@/pages/partner/PartnerStudentsPage";

export const Route = createFileRoute("/partner/students")({
  component: PartnerStudentsPage,
});
