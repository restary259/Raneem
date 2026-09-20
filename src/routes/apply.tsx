import { createFileRoute } from "@tanstack/react-router";
import ApplyPage from "@/pages/ApplyPage";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/apply" }],
    links: [{ rel: "canonical", href: "https://darb.agency/apply" }],
  }),
});
