import { createFileRoute } from "@tanstack/react-router";
import PartnerProfilePage from "@/pages/partner/PartnerProfilePage";

export const Route = createFileRoute("/partner/profile")({
  component: PartnerProfilePage,
});
