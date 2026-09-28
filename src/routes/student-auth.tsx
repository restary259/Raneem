import { createFileRoute } from "@tanstack/react-router";
import StudentAuthPage from "@/pages/StudentAuthPage";

export const Route = createFileRoute("/student-auth")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: StudentAuthPage,
});
