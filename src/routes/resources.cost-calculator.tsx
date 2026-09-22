import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/resources/cost-calculator")({
  beforeLoad: () => {
    throw redirect({ to: "/resources" });
  },
});
