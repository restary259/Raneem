import { createFileRoute } from "@tanstack/react-router";
import ResourcesPage from "@/pages/ResourcesPage";

export const Route = createFileRoute("/resources/")({
  component: ResourcesPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/resources" }],
    links: [{ rel: "canonical", href: "https://darb.agency/resources" }],
  }),
});
