import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in DARB user's name, email and role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const [{ data: profile }, { data: role }] = await Promise.all([
      sb.from("profiles").select("full_name, email").eq("id", ctx.getUserId()!).maybeSingle(),
      sb.rpc("get_my_role"),
    ]);
    const result = {
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? ctx.getUserEmail() ?? null,
      role: typeof role === "string" ? role : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
