import { supabase } from "@/integrations/supabase/client";

export type MessageVisibility = "internal" | "shared";

export interface CaseMessage {
  id: string;
  case_id: string;
  author_id: string | null;
  author_role: string;
  author_name: string | null;
  body: string;
  visibility: MessageVisibility;
  created_at: string;
}

/** Messages on a case, oldest first. RLS decides what the caller may see. */
export async function listCaseMessages(caseId: string): Promise<CaseMessage[]> {
  const { data, error } = await (supabase as any)
    .from("case_messages")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseMessage[];
}

/** Send a message. The server stamps the real author and enforces visibility. */
export async function sendCaseMessage(
  caseId: string,
  body: string,
  visibility: MessageVisibility = "shared",
): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message body required");
  const { data, error } = await (supabase as any).rpc("send_case_message", {
    p_case_id: caseId,
    p_body: trimmed,
    p_visibility: visibility,
  });
  if (error) throw error;
  return data as string;
}

/** Mark the thread as read for the current user. */
export async function markCaseMessagesRead(caseId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_case_messages_read", { p_case_id: caseId });
  if (error) throw error;
}

/** Number of messages in the thread newer than the caller's last read marker. */
export async function unreadCaseMessageCount(caseId: string, userId: string): Promise<number> {
  const { data: marker } = await (supabase as any)
    .from("case_message_reads")
    .select("last_read_at")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();

  let query = (supabase as any)
    .from("case_messages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .neq("author_id", userId);

  if (marker?.last_read_at) query = query.gt("created_at", marker.last_read_at);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
