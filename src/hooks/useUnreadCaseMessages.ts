import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { totalUnreadCaseMessages } from "@/services/CaseMessageService";

/** Live count of unread case messages across every thread the user can see. */
export function useUnreadCaseMessages(enabled = true): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) return;
    try {
      setCount(await totalUnreadCaseMessages(user.id));
    } catch {
      /* non-blocking badge */
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    const channel = supabase
      .channel("unread-case-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "case_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "case_message_reads" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, user?.id, load]);

  return count;
}
