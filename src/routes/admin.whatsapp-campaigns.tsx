import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

// The WhatsApp Campaigns page was removed; old links land on admin Messages.
export const Route = createFileRoute("/admin/whatsapp-campaigns")({
  component: () => <Navigate to="/admin/messages?tab=whatsapp" replace />,
});
