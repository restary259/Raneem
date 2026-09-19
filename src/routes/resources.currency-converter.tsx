import { createFileRoute } from "@tanstack/react-router";
import CurrencyConverterPage from "@/pages/CurrencyConverterPage";

export const Route = createFileRoute("/resources/currency-converter")({
  component: CurrencyConverterPage,
});
