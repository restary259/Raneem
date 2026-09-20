import { createFileRoute } from "@tanstack/react-router";
import BagrutCalculatorPage from "@/pages/BagrutCalculatorPage";

export const Route = createFileRoute("/resources/bagrut-calculator")({
  component: BagrutCalculatorPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/resources/bagrut-calculator" }],
    links: [{ rel: "canonical", href: "https://darb.agency/resources/bagrut-calculator" }],
  }),
});
