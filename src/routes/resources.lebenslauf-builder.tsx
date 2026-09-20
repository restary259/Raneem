import { createFileRoute } from "@tanstack/react-router";
import LebenslaufBuilderPage from "@/pages/LebenslaufBuilderPage";

export const Route = createFileRoute("/resources/lebenslauf-builder")({
  component: LebenslaufBuilderPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/resources/lebenslauf-builder" }],
    links: [{ rel: "canonical", href: "https://darb.agency/resources/lebenslauf-builder" }],
  }),
});
