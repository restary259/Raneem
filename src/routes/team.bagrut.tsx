import { createFileRoute } from "@tanstack/react-router";
import TeamBagrutConverter from "@/pages/team/BagrutConverter";

export const Route = createFileRoute("/team/bagrut")({
  component: TeamBagrutConverter,
});
