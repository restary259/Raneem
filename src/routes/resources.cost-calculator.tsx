import { createFileRoute } from "@tanstack/react-router";
import CostCalculatorPage from "@/pages/CostCalculatorPage";

export const Route = createFileRoute("/resources/cost-calculator")({
  component: CostCalculatorPage,
});
