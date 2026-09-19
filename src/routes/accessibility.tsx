import { createFileRoute } from "@tanstack/react-router";
import AccessibilityStatementPage from "@/pages/legal/AccessibilityStatementPage";

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityStatementPage,
});
