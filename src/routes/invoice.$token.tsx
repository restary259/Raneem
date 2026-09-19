import { createFileRoute } from "@tanstack/react-router";
import InvoicePage from "@/pages/InvoicePage";

export const Route = createFileRoute("/invoice/$token")({
  component: InvoicePage,
});
