import { createFileRoute } from "@tanstack/react-router";
import JoinPartnerPage from "@/pages/JoinPartnerPage";

export const Route = createFileRoute("/join/$code")({
  component: JoinPartnerPage,
});
