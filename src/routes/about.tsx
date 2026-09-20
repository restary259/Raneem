import { createFileRoute } from "@tanstack/react-router";
import WhoWeArePage from "@/pages/WhoWeArePage";

export const Route = createFileRoute("/about")({
  component: WhoWeArePage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/about" }],
    links: [{ rel: "canonical", href: "https://darb.agency/about" }],
  }),
});
