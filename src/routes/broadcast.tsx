import { createFileRoute } from "@tanstack/react-router";
import BroadcastPage from "@/pages/BroadcastPage";

export const Route = createFileRoute("/broadcast")({
  component: BroadcastPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/broadcast" }],
    links: [{ rel: "canonical", href: "https://darb.agency/broadcast" }],
  }),
});
