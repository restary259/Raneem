import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/legal/TermsPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/terms" }],
    links: [{ rel: "canonical", href: "https://darb.agency/terms" }],
  }),
});
