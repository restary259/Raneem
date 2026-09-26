import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cases",
  title: "List cases",
  description: "List the student cases the signed-in user is allowed to see, newest first.",
  inputSchema: {
    status: z.string().optional().describe("Optional pipeline status filter, e.g. new, contacted, submitted."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("cases")
      .select("id, full_name, status, city, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const cases = (data ?? []).map((c) => ({
      id: String(c.id),
      full_name: c.full_name ?? null,
      status: c.status ?? null,
      city: c.city ?? null,
      created_at: c.created_at ?? null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(cases) }], structuredContent: { cases } };
  },
});
