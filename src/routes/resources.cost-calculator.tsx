import { createFileRoute } from "@tanstack/react-router";
import CostCalculatorPage from "@/pages/CostCalculatorPage";

export const Route = createFileRoute("/resources/cost-calculator")({
  component: CostCalculatorPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/resources/cost-calculator" }],
    links: [{ rel: "canonical", href: "https://darb.agency/resources/cost-calculator" }],
  }),
});
