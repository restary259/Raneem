import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCaseMessages } from "@/hooks/useUnreadCaseMessages";
import { clearAppBadge, updateAppBadge } from "@/lib/appBadge";

/** Live count of unread in-app notifications for the signed-in user. */
function useUnreadNotifications(enabled: boolean): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) return;
    const { count: rows } = await (supabase as any)
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setCount(rows ?? 0);
  }, [enabled, user?.id]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;
    const channel = supabase
      .channel("app-badge-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          loadRef.current().catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, user?.id]);

  // A push landing while the tab is open should bump the badge immediately.
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") loadRef.current().catch(() => undefined);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [enabled]);

  return count;
}

/**
 * Keeps the OS app-icon badge and the browser-tab badge in sync with the
 * user's unread notifications + unread messages. Mount once per session.
 */
export function useAppBadge(): void {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id);
  const notifications = useUnreadNotifications(signedIn);
  const messages = useUnreadCaseMessages(signedIn);

  useEffect(() => {
    if (!signedIn) {
      clearAppBadge();
      return;
    }
    updateAppBadge(notifications + messages);
  }, [signedIn, notifications, messages]);

  useEffect(() => () => clearAppBadge(), []);
}
