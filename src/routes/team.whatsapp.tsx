import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/team/whatsapp")({
  component: () => <Navigate to="/team/messages?tab=whatsapp" replace />,
});
