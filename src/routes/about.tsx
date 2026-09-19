import { createFileRoute } from "@tanstack/react-router";
import WhoWeArePage from "@/pages/WhoWeArePage";

export const Route = createFileRoute("/about")({
  component: WhoWeArePage,
});
