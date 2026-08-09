import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeTables } from "@/lib/realtimeRegistry";
import { useAuth } from "@/contexts/AuthContext";
import { totalUnreadCaseMessages } from "@/services/CaseMessageService";
import { totalUnreadDirectMessages } from "@/services/DirectMessageService";

/** Live count of unread case + direct messages across every thread the user can see. */
export function useUnreadCaseMessages(enabled = true): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) return;
    try {
      const [cases, direct] = await Promise.all([
        totalUnreadCaseMessages(user.id).catch(() => 0),
        totalUnreadDirectMessages(user.id).catch(() => 0),
      ]);
      setCount(cases + direct);
    } catch {
      /* non-blocking badge */
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  /* Reading a thread dispatches this so the badge clears without a round trip. */
  useEffect(() => {
    const onRead = () => load();
    window.addEventListener("darb:threads-read", onRead);
    return () => window.removeEventListener("darb:threads-read", onRead);
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;
    return subscribeTables(
      "unread-case-messages",
      ["case_messages", "case_message_reads", "direct_messages", "direct_thread_participants"],
      () => loadRef.current(),
    );
  }, [enabled, user?.id]);

  return count;
}
