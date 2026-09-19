import { createFileRoute } from "@tanstack/react-router";
import BlogIndexPage from "@/pages/blog/BlogIndexPage";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
});
