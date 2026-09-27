import { supabase } from "@/integrations/supabase/client";

/**
 * Thin wrappers over the voice-call RPCs. Every state change is decided
 * server-side (auth.uid() is always the actor); the browser only asks.
 */

export type VoiceCallStatus =
  | "ringing"
  | "accepted"
  | "declined"
  | "cancelled"
  | "ended"
  | "missed"
  | "failed";

export interface VoiceCallRow {
  id: string;
  thread_id: string;
  caller_id: string;
  callee_id: string;
  status: VoiceCallStatus;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

export const isLiveStatus = (s: VoiceCallStatus | undefined | null) =>
  s === "ringing" || s === "accepted";

export async function canCallUser(me: string, other: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_communicate_directly", { p_a: me, p_b: other });
  if (error) return false;
  return data === true;
}

export async function startVoiceCall(calleeId: string, threadId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_voice_call", {
    p_callee_id: calleeId,
    p_thread_id: threadId,
  });
  if (error) throw error;
  return data as string;
}

export async function acceptVoiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_voice_call", { p_call_id: callId });
  if (error) throw error;
}

export async function declineVoiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_voice_call", { p_call_id: callId });
  if (error) throw error;
}

export async function cancelVoiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_voice_call", { p_call_id: callId });
  if (error) throw error;
}

export async function endVoiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("end_voice_call", { p_call_id: callId });
  if (error) throw error;
}

export async function heartbeatVoiceCall(callId: string): Promise<void> {
  const { error } = await supabase.rpc("heartbeat_voice_call", { p_call_id: callId });
  if (error) throw error;
}

export async function getVoiceCall(callId: string): Promise<VoiceCallRow | null> {
  const { data, error } = await supabase.rpc("get_voice_call", { p_call_id: callId });
  if (error) throw error;
  return (data as unknown as VoiceCallRow) ?? null;
}

export async function getActiveVoiceCall(): Promise<VoiceCallRow | null> {
  const { data, error } = await supabase.rpc("get_active_voice_call");
  if (error) throw error;
  return (data as unknown as VoiceCallRow) ?? null;
}

export async function resolveName(userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("resolve_profile_names", { p_ids: [userId] });
  return data?.[0]?.full_name ?? null;
}

/** The other participant of a one-to-one direct thread. */
export async function getOtherParticipant(threadId: string, me: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("direct_thread_participants")
    .select("user_id")
    .eq("thread_id", threadId);
  if (error || !data) return null;
  return data.map((r) => r.user_id).find((id) => id !== me) ?? null;
}
