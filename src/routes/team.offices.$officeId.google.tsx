import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/team/offices/$officeId/google")({
  component: () => <Outlet />,
});
