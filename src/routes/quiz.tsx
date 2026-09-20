import { createFileRoute } from "@tanstack/react-router";
import QuizPage from "@/pages/QuizPage";

export const Route = createFileRoute("/quiz")({
  component: QuizPage,
  head: () => ({
    meta: [{ property: "og:url", content: "https://darb.agency/quiz" }],
    links: [{ rel: "canonical", href: "https://darb.agency/quiz" }],
  }),
});
