import { createFileRoute } from "@tanstack/react-router";
import ServicesPage from "@/pages/ServicesPage";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/services" }],
    links: [{ rel: "canonical", href: "https://darb.agency/services" }],
  }),
});
