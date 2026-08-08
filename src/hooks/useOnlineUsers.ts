import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Shared realtime presence channel for signed-in staff/students.
 * Presence only — nothing is written to the database.
 */
export function useOnlineUsers(): Set<string> {
  const { user } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setOnline(new Set());
      return;
    }

    const channel = supabase.channel("presence:staff", {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnline(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return online;
}
