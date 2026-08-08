import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const TYPING_TTL_MS = 4000;
const THROTTLE_MS = 1500;

export interface TypingPerson {
  id: string;
  name: string;
}

/**
 * Realtime "is typing" for one conversation. Broadcast only — nothing is stored.
 * Returns the people currently typing plus a throttled `notifyTyping()`.
 */
export function useTypingIndicator(threadType: "case" | "direct", threadId: string | null) {
  const { user } = useAuth();
  const [typing, setTyping] = useState<TypingPerson[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const seenRef = useRef<Map<string, { name: string; at: number }>>(new Map());

  useEffect(() => {
    if (!threadId || !user?.id) return;
    seenRef.current = new Map();
    setTyping([]);

    const channel = supabase.channel(`typing:${threadType}:${threadId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = payload?.userId as string | undefined;
        if (!id || id === user.id) return;
        seenRef.current.set(id, { name: payload?.name ?? "", at: Date.now() });
        setTyping(
          [...seenRef.current.entries()].map(([personId, v]) => ({ id: personId, name: v.name })),
        );
      })
      .subscribe();

    channelRef.current = channel;

    const timer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, v] of seenRef.current) {
        if (now - v.at > TYPING_TTL_MS) {
          seenRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        setTyping(
          [...seenRef.current.entries()].map(([personId, v]) => ({ id: personId, name: v.name })),
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [threadType, threadId, user?.id]);

  const notifyTyping = useCallback(
    (name: string) => {
      const now = Date.now();
      if (!channelRef.current || !user?.id) return;
      if (now - lastSentRef.current < THROTTLE_MS) return;
      lastSentRef.current = now;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, name },
      });
    },
    [user?.id],
  );

  return { typing, notifyTyping };
}
