import { createFileRoute } from "@tanstack/react-router";
import InvoicePage from "@/pages/InvoicePage";

export const Route = createFileRoute("/invoice/$token")({
  component: InvoicePage,
  head: () => ({
    meta: [
      { title: "DARB Service Invoice | درب" },
      { name: "description", content: "Secure DARB service invoice with service details and payment status." },
      { property: "og:title", content: "DARB Service Invoice | درب" },
      { property: "og:description", content: "Secure DARB service invoice with service details and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
