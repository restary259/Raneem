import { createFileRoute } from "@tanstack/react-router";
import WhatsAppCampaignsPage from "@/pages/admin/WhatsAppCampaignsPage";

export const Route = createFileRoute("/admin/whatsapp-campaigns")({
  component: WhatsAppCampaignsPage,
});
