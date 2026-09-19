import { createFileRoute } from "@tanstack/react-router";
import QuizPage from "@/pages/QuizPage";

export const Route = createFileRoute("/quiz")({
  component: QuizPage,
});
