import { createFileRoute } from "@tanstack/react-router";
import LebenslaufBuilderPage from "@/pages/LebenslaufBuilderPage";

export const Route = createFileRoute("/resources/lebenslauf-builder")({
  component: LebenslaufBuilderPage,
});
