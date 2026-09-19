import { createFileRoute } from "@tanstack/react-router";
import PartnerOverviewPage from "@/pages/partner/PartnerOverviewPage";

export const Route = createFileRoute("/partner/")({
  component: PartnerOverviewPage,
});
