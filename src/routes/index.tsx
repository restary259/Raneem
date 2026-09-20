import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/" }],
    links: [{ rel: "canonical", href: "https://darb.agency/" }],
  }),
});
