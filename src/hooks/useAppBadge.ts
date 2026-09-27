import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCaseMessages } from "@/hooks/useUnreadCaseMessages";
import { clearAppBadge, updateAppBadge } from "@/lib/appBadge";

const REALTIME_RETRY_MS = 15_000;

function useUnreadNotifications(enabled: boolean): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) return;
    const { count: rows, error } = await (supabase as any)
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (!error) setCount(rows ?? 0);
  }, [enabled, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    // Unique per mount/attempt: supabase.channel() returns an existing channel
    // for a reused topic, and adding callbacks after subscribe() throws.
    const channelName = () =>
      `app-badge-notifications-${user.id}-${Math.random().toString(36).slice(2, 10)}`;

    const subscribe = () => {
      if (disposed) return;
      const channel = supabase
        .channel(channelName())
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => void loadRef.current(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => void loadRef.current(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (disposed) return;
            if (retryTimer) return;
            retryTimer = setTimeout(async () => {
              retryTimer = undefined;
              await supabase.removeChannel(channel).catch(() => undefined);
              if (disposed) return;
              current = subscribe();
              void loadRef.current();
            }, REALTIME_RETRY_MS);
          }
        });

      return channel;
    };

    let current = subscribe();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (current) void supabase.removeChannel(current);
    };
  }, [enabled, user?.id]);

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") void loadRef.current();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [enabled]);

  return count;
}

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
