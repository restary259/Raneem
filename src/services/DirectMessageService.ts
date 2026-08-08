import { supabase } from "@/integrations/supabase/client";

export interface DirectMessage {
  id: string;
  thread_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: string | null;
  body: string;
  created_at: string;
}

export interface DirectThread {
  threadId: string;
  otherUserId: string | null;
  otherUserName: string;
  otherUserRole: string | null;
  lastMessage: DirectMessage | null;
  lastMessageAt: string;
  unread: number;
}

export interface StaffMember {
  id: string;
  full_name: string;
  role: string;
}

/** Staff the current user may open a direct chat with (server-filtered). */
export async function listStaffDirectory(): Promise<StaffMember[]> {
  const { data, error } = await (supabase as any).rpc("get_staff_directory");
  if (error) throw error;
  return (data ?? []) as StaffMember[];
}

/** Open (or reuse) a one-to-one thread. Server enforces who may talk to whom. */
export async function startDirectThread(otherUserId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("start_direct_thread", {
    p_other_user: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function listDirectMessages(threadId: string): Promise<DirectMessage[]> {
  const { data, error } = await (supabase as any)
    .from("direct_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(threadId: string, body: string): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message body required");
  const { data, error } = await (supabase as any).rpc("send_direct_message", {
    p_thread_id: threadId,
    p_body: trimmed,
  });
  if (error) throw error;
  return data as string;
}

export async function markDirectThreadRead(threadId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_direct_thread_read", {
    p_thread_id: threadId,
  });
  if (error) throw error;
}

/** All direct threads the caller takes part in, newest activity first. */
export async function listMyDirectThreads(userId: string): Promise<DirectThread[]> {
  const { data: mine, error } = await (supabase as any)
    .from("direct_thread_participants")
    .select("thread_id, last_read_at")
    .eq("user_id", userId);
  if (error) throw error;

  const rows = (mine ?? []) as { thread_id: string; last_read_at: string | null }[];
  if (rows.length === 0) return [];

  const threadIds = rows.map((r) => r.thread_id);

  const [{ data: participants }, { data: messages }, { data: threads }] = await Promise.all([
    (supabase as any)
      .from("direct_thread_participants")
      .select("thread_id, user_id")
      .in("thread_id", threadIds),
    (supabase as any)
      .from("direct_messages")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
    (supabase as any).from("direct_threads").select("id, last_message_at").in("id", threadIds),
  ]);

  const others = new Map<string, string>();
  for (const p of (participants ?? []) as { thread_id: string; user_id: string }[]) {
    if (p.user_id !== userId) others.set(p.thread_id, p.user_id);
  }

  const otherIds = [...new Set([...others.values()])];
  const nameMap = new Map<string, { name: string; role: string | null }>();
  if (otherIds.length > 0) {
    // Staff directory is a security-definer view of staff; regular profile reads
    // are blocked by RLS between staff members.
    const directory = await listStaffDirectory().catch(() => [] as StaffMember[]);
    for (const member of directory) {
      if (otherIds.includes(member.id)) nameMap.set(member.id, { name: member.full_name, role: member.role });
    }
    const missing = otherIds.filter((id) => !nameMap.has(id));
    if (missing.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", missing);
      for (const p of (profiles ?? []) as any[]) {
        nameMap.set(p.id, { name: p.full_name, role: null });
      }
    }
  }


  const msgs = (messages ?? []) as DirectMessage[];
  const latest = new Map<string, DirectMessage>();
  for (const m of msgs) if (!latest.has(m.thread_id)) latest.set(m.thread_id, m);

  const lastActivity = new Map<string, string>(
    ((threads ?? []) as any[]).map((t) => [t.id, t.last_message_at]),
  );

  return rows
    .map((r) => {
      const otherId = others.get(r.thread_id) ?? null;
      const info = otherId ? nameMap.get(otherId) : undefined;
      const unread = msgs.filter(
        (m) =>
          m.thread_id === r.thread_id &&
          m.author_id !== userId &&
          (!r.last_read_at || new Date(m.created_at) > new Date(r.last_read_at)),
      ).length;
      return {
        threadId: r.thread_id,
        otherUserId: otherId,
        otherUserName: info?.name ?? "—",
        otherUserRole: info?.role ?? null,
        lastMessage: latest.get(r.thread_id) ?? null,
        lastMessageAt: lastActivity.get(r.thread_id) ?? new Date(0).toISOString(),
        unread,
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

/** Total unread direct messages for the badge. */
export async function totalUnreadDirectMessages(userId: string): Promise<number> {
  const threads = await listMyDirectThreads(userId);
  return threads.reduce((sum, t) => sum + t.unread, 0);
}
