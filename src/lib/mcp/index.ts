import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listCasesTool from "./tools/list-cases";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "darb-agency",
  title: "darb-agency",
  version: "0.1.0",
  instructions:
    "Read-only tools for DARB, a study-in-Germany agency. Use `whoami` to see the signed-in user and role, and `list_cases` to list student cases visible to that user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listCasesTool],
});
