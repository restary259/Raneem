import { createFileRoute } from "@tanstack/react-router";
import PrivacyPolicyPage from "@/pages/legal/PrivacyPolicyPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/privacy" }],
    links: [{ rel: "canonical", href: "https://darb.agency/privacy" }],
  }),
});
