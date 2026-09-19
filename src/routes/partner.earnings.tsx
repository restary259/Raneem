import { createFileRoute } from "@tanstack/react-router";
import PartnerEarningsPage from "@/pages/partner/PartnerEarningsPage";

export const Route = createFileRoute("/partner/earnings")({
  component: PartnerEarningsPage,
});
