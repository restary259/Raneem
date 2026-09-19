import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/FaqPage";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});
