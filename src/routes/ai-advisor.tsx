import { createFileRoute } from "@tanstack/react-router";
import AIAdvisorPage from "@/pages/AIAdvisorPage";

export const Route = createFileRoute("/ai-advisor")({
  component: AIAdvisorPage,
});
