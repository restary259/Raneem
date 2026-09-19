import { createFileRoute } from "@tanstack/react-router";
import StudentMessagesPage from "@/pages/messages/StudentMessagesPage";

export const Route = createFileRoute("/student/messages")({
  component: StudentMessagesPage,
});
