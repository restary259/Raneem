import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/legal/TermsPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});
