import { createFileRoute } from "@tanstack/react-router";
import LocationsPage from "@/pages/LocationsPage";

export const Route = createFileRoute("/locations")({
  component: LocationsPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/locations" }],
    links: [{ rel: "canonical", href: "https://darb.agency/locations" }],
  }),
});
