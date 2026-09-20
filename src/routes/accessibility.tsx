import { createFileRoute } from "@tanstack/react-router";
import AccessibilityStatementPage from "@/pages/legal/AccessibilityStatementPage";

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityStatementPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/accessibility" }],
    links: [{ rel: "canonical", href: "https://darb.agency/accessibility" }],
  }),
});
