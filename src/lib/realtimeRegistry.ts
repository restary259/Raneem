import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Reference-counted Supabase realtime channels.
 *
 * Several components can ask for the same topic (e.g. the sidebar badge and
 * the notification bell both watch `direct_messages`). Without pooling, every
 * mount opened its own websocket channel and repeated navigation
 * (Cases -> Dashboard -> Cases) stacked subscriptions until the tab was
 * reloaded. Here each topic is opened once and torn down when the last
 * subscriber unmounts.
 *
 * Security is unchanged: realtime still runs through the same authenticated
 * client and the same RLS policies.
 */

type Listener = () => void;

interface Entry {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
}

const entries = new Map<string, Entry>();

/**
 * Subscribe to postgres changes on one or more tables under a shared topic.
 * Returns an unsubscribe function; the channel closes when the count hits 0.
 */
export function subscribeTables(
  topic: string,
  tables: string[],
  listener: Listener,
): () => void {
  let entry = entries.get(topic);

  if (!entry) {
    let channel = supabase.channel(topic);
    const fanOut = () => {
      const current = entries.get(topic);
      current?.listeners.forEach((l) => {
        try {
          l();
        } catch {
          /* one bad listener must not break the others */
        }
      });
    };
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        fanOut,
      );
    }
    channel.subscribe();
    entry = { channel, listeners: new Set() };
    entries.set(topic, entry);
  }

  entry.listeners.add(listener);

  return () => {
    const current = entries.get(topic);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      entries.delete(topic);
      supabase.removeChannel(current.channel);
    }
  };
}

/** Test/diagnostic helper: how many pooled channels are currently open. */
export function openChannelCount(): number {
  return entries.size;
}
