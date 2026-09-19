import { createFileRoute } from "@tanstack/react-router";
import LocationsPage from "@/pages/LocationsPage";

export const Route = createFileRoute("/locations")({
  component: LocationsPage,
});
