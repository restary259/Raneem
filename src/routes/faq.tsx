import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/FaqPage";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/faq" }],
    links: [{ rel: "canonical", href: "https://darb.agency/faq" }],
  }),
});
