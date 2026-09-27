import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/FaqPage";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "الأسئلة الشائعة | درب" },
      { name: "description", content: "إجابات موثقة عن الدراسة في ألمانيا: القبول، اللغة، التأشيرة، التكاليف والسكن للطلاب العرب." },
      { property: "og:title", content: "الأسئلة الشائعة | درب" },
      { property: "og:description", content: "إجابات موثقة عن الدراسة في ألمانيا: القبول، اللغة، التأشيرة، التكاليف والسكن للطلاب العرب." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://darb.agency/faq" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://darb.agency/faq" }],
  }),
  component: FaqPage,
});
