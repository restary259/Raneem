import { createFileRoute } from "@tanstack/react-router";
import BagrutCalculatorPage from "@/pages/BagrutCalculatorPage";

export const Route = createFileRoute("/resources/bagrut-calculator")({
  component: BagrutCalculatorPage,
});
