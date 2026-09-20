import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Shared staff presence.
 *
 * We intentionally avoid registering presence callbacks on a channel that may
 * be remounted/reconciled during React navigation. Instead, the channel is
 * fully configured before subscribe() and its current presence state is polled
 * while subscribed. This prevents the Realtime "cannot add presence callbacks
 * after subscribe()" race from taking down the internal messaging workspace.
 */
export function useOnlineUsers(): Set<string> {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setOnline(new Set());
      return;
    }

    let cancelled = false;
    let pollId: ReturnType<typeof window.setInterval> | null = null;

    const channel = supabase.channel("presence:staff", {
      config: { presence: { key: user.id } },
    });

    const refresh = () => {
      if (cancelled) return;
      try {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnline(new Set(Object.keys(state)));
      } catch {
        // Presence state is unavailable until the channel is subscribed.
      }
    };

    channel.subscribe(async (status) => {
      if (cancelled) return;

      if (status === "SUBSCRIBED") {
        try {
          await channel.track({
            user_id: user.id,
            at: new Date().toISOString(),
          });
        } catch {
          // Presence is auxiliary; never break the messaging workspace.
        }

        refresh();
        pollId = window.setInterval(refresh, 5000);
      }
    });

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return online;
}
