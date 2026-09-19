import { createFileRoute } from "@tanstack/react-router";
import PartnershipPage from "@/pages/PartnershipPage";

export const Route = createFileRoute("/partnership")({
  component: PartnershipPage,
});
