import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/partners")({
  component: () => <Navigate to="/partnership" replace />,
});
