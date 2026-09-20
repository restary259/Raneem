import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/ContactPage";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/contact" }],
    links: [{ rel: "canonical", href: "https://darb.agency/contact" }],
  }),
});
