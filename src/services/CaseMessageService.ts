import { supabase } from "@/integrations/supabase/client";
import type { ChatAttachment, ChatMessage } from "@/lib/chatFormat";

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
  attachments: ChatAttachment[] | null;
  kind: "text" | "request" | null;
  request_status: string | null;
  edited_at?: string | null;
  mentions?: string[] | null;
}

export function toChatMessage(m: CaseMessage): ChatMessage {
  return {
    id: m.id,
    authorId: m.author_id,
    authorName: m.author_name,
    authorRole: m.author_role,
    body: m.body,
    createdAt: m.created_at,
    visibility: m.visibility,
    attachments: (m.attachments ?? []) as ChatAttachment[],
    kind: (m.kind ?? "text") as "text" | "request",
    requestStatus: m.request_status,
    editedAt: m.edited_at ?? null,
    mentions: (m.mentions ?? []) as string[],
  };
}

/** Messages on a case, oldest first. RLS decides what the caller may see. */
export async function listCaseMessages(caseId: string, limit = 50): Promise<CaseMessage[]> {
  const { data, error } = await (supabase as any)
    .from("case_messages")
    .select("*")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as CaseMessage[]).slice().reverse();
}

/** Send a message. The server stamps the real author and enforces visibility. */
export async function sendCaseMessage(
  caseId: string,
  body: string,
  visibility: MessageVisibility = "shared",
  attachments: ChatAttachment[] = [],
  kind: "text" | "request" = "text",
  mentions: string[] = [],
): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) throw new Error("Message body required");
  const { data, error } = await (supabase as any).rpc("send_case_message", {
    p_case_id: caseId,
    p_body: trimmed,
    p_visibility: visibility,
    p_attachments: attachments,
    p_kind: kind,
    p_mentions: mentions,
  });
  if (error) throw error;
  return data as string;
}

/** Edit your own plain message inside the 15-minute window. */
export async function editCaseMessage(messageId: string, body: string): Promise<void> {
  const { error } = await (supabase as any).rpc("edit_case_message", {
    p_message_id: messageId,
    p_body: body.trim(),
  });
  if (error) throw error;
}

export interface ThreadReadState {
  user_id: string;
  full_name: string | null;
  last_read_at: string | null;
}

/** Who has read this thread and up to when — powers read receipts. */
export async function getThreadReadState(
  kind: "case" | "direct",
  id: string,
): Promise<ThreadReadState[]> {
  const { data, error } = await (supabase as any).rpc("get_thread_read_state", {
    p_kind: kind,
    p_id: id,
  });
  if (error) throw error;
  return (data ?? []) as ThreadReadState[];
}


/** Upload a file that answers a pending document request. */
export async function fulfilDocumentRequest(
  messageId: string,
  attachment: ChatAttachment,
): Promise<void> {
  const { error } = await (supabase as any).rpc("fulfil_document_request", {
    p_message_id: messageId,
    p_attachment: attachment,
  });
  if (error) throw error;
}

/** Mark the thread as read for the current user. */
export async function markCaseMessagesRead(caseId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_case_messages_read", { p_case_id: caseId });
  if (error) throw error;
  // Let the header/sidebar badges drop immediately instead of waiting on realtime.
  window.dispatchEvent(new Event("darb:threads-read"));
}


export async function getCaseLastRead(caseId: string, userId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("case_message_reads")
    .select("last_read_at")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.last_read_at ?? null;
}

/** Number of messages in the thread newer than the caller's last read marker. */
export async function unreadCaseMessageCount(caseId: string, userId: string): Promise<number> {
  const lastRead = await getCaseLastRead(caseId, userId);

  let query = (supabase as any)
    .from("case_messages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .neq("author_id", userId);

  if (lastRead) query = query.gt("created_at", lastRead);

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
    .is("deleted_at", null)
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
    // A thread with no surviving case row is orphaned — never show it.
    .filter((caseId) => caseMap.has(caseId))
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

/* ── Mutes ──────────────────────────────────────────────────────────────── */

export async function listMutedThreads(
  userId: string,
): Promise<{ thread_type: string; thread_id: string }[]> {
  const { data } = await (supabase as any)
    .from("message_thread_mutes")
    .select("thread_type, thread_id")
    .eq("user_id", userId);
  return (data ?? []) as { thread_type: string; thread_id: string }[];
}

export async function setThreadMuted(
  userId: string,
  threadType: "case" | "direct",
  threadId: string,
  muted: boolean,
): Promise<void> {
  if (muted) {
    const { error } = await (supabase as any)
      .from("message_thread_mutes")
      .insert({ user_id: userId, thread_type: threadType, thread_id: threadId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await (supabase as any)
      .from("message_thread_mutes")
      .delete()
      .eq("user_id", userId)
      .eq("thread_type", threadType)
      .eq("thread_id", threadId);
    if (error) throw error;
  }
}

/* ── Case mentions (#REF) ───────────────────────────────────────────────── */

export interface CaseMentionResult {
  id: string;
  case_reference: string | null;
  full_name: string;
  status: string;
}

/** Staff-only case search backing the `#` mention picker. */
export async function searchCasesForMention(query: string): Promise<CaseMentionResult[]> {
  const { data, error } = await (supabase as any).rpc("search_cases_for_mention", {
    p_query: query,
  });
  if (error) throw error;
  return (data ?? []) as CaseMentionResult[];
}

/**
 * Map `#REF` tokens found in messages back to case ids so they can be linked.
 * Falls back to a short-id match for cases that have no reference yet.
 */
export async function resolveCaseRefs(refs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const results = await Promise.all(
    refs.map((ref) => searchCasesForMention(ref).catch(() => [] as CaseMentionResult[])),
  );
  refs.forEach((ref, i) => {
    const lower = ref.toLowerCase();
    const hit = results[i].find(
      (c) => c.case_reference?.toLowerCase() === lower || c.id.slice(0, 8).toLowerCase() === lower,
    );
    if (hit) map.set(ref, hit.id);
  });
  return map;
}

/**
 * Admin-only moderation. Soft-deletes are performed by SECURITY DEFINER RPCs
 * that also write to admin_audit_log — the client never touches the message rows.
 */
export async function deleteChatMessage(messageId: string, kind: "case" | "direct"): Promise<void> {
  const { error } = await (supabase as any).rpc("delete_chat_message", { p_message_id: messageId, p_kind: kind });
  if (error) throw error;
}

export async function clearCaseThread(caseId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("clear_case_thread", { p_case_id: caseId });
  if (error) throw error;
  return Number(data ?? 0);
}
