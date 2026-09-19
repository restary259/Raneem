import { createFileRoute } from "@tanstack/react-router";
import PartnerApplyPage from "@/pages/partner/PartnerApplyPage";

export const Route = createFileRoute("/partner/apply")({
  component: PartnerApplyPage,
});
