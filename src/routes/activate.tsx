import { createFileRoute } from "@tanstack/react-router";
import ActivateAccountPage from "@/pages/ActivateAccountPage";

export const Route = createFileRoute("/activate")({
  component: ActivateAccountPage,
});
