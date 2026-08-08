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

export interface CaseMessageThread {
  caseId: string;
  caseName: string;
  caseReference: string | null;
  caseStatus: string;
  lastMessage: CaseMessage;
  unread: number;
}

/**
 * All case threads the caller can see, newest activity first.
 * RLS already scopes `case_messages` to the caller's cases.
 */
export async function listMyCaseThreads(userId: string, limit = 300): Promise<CaseMessageThread[]> {
  const { data: messages, error } = await (supabase as any)
    .from("case_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (messages ?? []) as CaseMessage[];
  if (rows.length === 0) return [];

  const latest = new Map<string, CaseMessage>();
  for (const m of rows) if (!latest.has(m.case_id)) latest.set(m.case_id, m);
  const caseIds = [...latest.keys()];

  const [{ data: cases }, { data: markers }] = await Promise.all([
    (supabase as any)
      .from("cases")
      .select("id, full_name, case_reference, status")
      .in("id", caseIds),
    (supabase as any)
      .from("case_message_reads")
      .select("case_id, last_read_at")
      .eq("user_id", userId)
      .in("case_id", caseIds),
  ]);

  const caseMap = new Map<string, any>((cases ?? []).map((c: any) => [c.id, c]));
  const readMap = new Map<string, string>(
    (markers ?? []).map((m: any) => [m.case_id, m.last_read_at]),
  );

  return caseIds
    .map((caseId) => {
      const info = caseMap.get(caseId);
      const lastRead = readMap.get(caseId);
      const unread = rows.filter(
        (m) =>
          m.case_id === caseId &&
          m.author_id !== userId &&
          (!lastRead || new Date(m.created_at) > new Date(lastRead)),
      ).length;
      return {
        caseId,
        caseName: info?.full_name ?? "—",
        caseReference: info?.case_reference ?? null,
        caseStatus: info?.status ?? "",
        lastMessage: latest.get(caseId)!,
        unread,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
    );
}

/** Total unread messages across all of the caller's case threads. */
export async function totalUnreadCaseMessages(userId: string): Promise<number> {
  const threads = await listMyCaseThreads(userId);
  return threads.reduce((sum, thread) => sum + thread.unread, 0);
}

