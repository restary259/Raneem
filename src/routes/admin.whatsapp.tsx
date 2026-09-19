import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin/whatsapp")({
  component: () => <Navigate to="/admin/messages?tab=whatsapp" replace />,
});
