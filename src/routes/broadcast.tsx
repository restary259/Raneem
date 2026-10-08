import { createFileRoute, redirect } from "@tanstack/react-router";
import BroadcastPage from "@/pages/BroadcastPage";

// Temporarily hidden from the public site; page kept for re-enabling later.
export const Route = createFileRoute("/broadcast")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: BroadcastPage,
});
