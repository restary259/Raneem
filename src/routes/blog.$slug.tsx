import { createFileRoute } from "@tanstack/react-router";
import BlogArticlePage from "@/pages/blog/BlogArticlePage";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogArticlePage,
});
