import { createFileRoute, redirect } from "@tanstack/react-router";
import LocationsPage from "@/pages/LocationsPage";

// Temporarily hidden from the public site; page kept for re-enabling later.
export const Route = createFileRoute("/locations")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: LocationsPage,
});
