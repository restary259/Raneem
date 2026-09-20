import { createFileRoute } from "@tanstack/react-router";
import CurrencyConverterPage from "@/pages/CurrencyConverterPage";

export const Route = createFileRoute("/resources/currency-converter")({
  component: CurrencyConverterPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/resources/currency-converter" }],
    links: [{ rel: "canonical", href: "https://darb.agency/resources/currency-converter" }],
  }),
});
