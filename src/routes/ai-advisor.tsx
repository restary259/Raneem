import { createFileRoute } from "@tanstack/react-router";
import AIAdvisorPage from "@/pages/AIAdvisorPage";

export const Route = createFileRoute("/ai-advisor")({
  component: AIAdvisorPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/ai-advisor" }],
    links: [{ rel: "canonical", href: "https://darb.agency/ai-advisor" }],
  }),
});
