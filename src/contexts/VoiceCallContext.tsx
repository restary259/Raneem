import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  acceptVoiceCall,
  cancelVoiceCall,
  declineVoiceCall,
  endVoiceCall,
  getActiveVoiceCall,
  getVoiceCall,
  heartbeatVoiceCall,
  isLiveStatus,
  resolveName,
  startVoiceCall,
} from "@/services/VoiceCallService";

/**
 * Global audio-call controller. Postgres decides whether a call may exist and
 * what state it is in; SDP/ICE ride the private Realtime topic `call:<id>`.
 * The callee creates the WebRTC offer after tapping Accept (that tap is the
 * user gesture iOS needs for the microphone).
 */

type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "connected";

interface CallView {
  id: string;
  peerId: string;
  peerName: string;
  role: "caller" | "callee";
}

interface VoiceCallContextValue {
  phase: Phase;
  inCall: boolean;
  startCall: (args: { threadId: string; peerId: string; peerName?: string }) => Promise<void>;
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/**
 * One shared AudioContext, unlocked on the user's first tap. Phones keep a
 * context created without a gesture suspended (silent), which is why a fresh
 * context per ring was inaudible.
 */
let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new AC();
    }
    if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => undefined);
    return sharedCtx;
  } catch {
    return null;
  }
}
if (typeof window !== "undefined") {
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** Looping ringtone (incoming: bright melodic phone ring) or ringback (outgoing). */
function startTone(kind: "ring" | "ringback"): () => void {
  let timer: number | undefined;
  const nodes: OscillatorNode[] = [];
  const play = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Ring: two quick trills of a classic dual-tone bell. Ringback: soft long tone.
    const notes: Array<[number, number, number]> =
      kind === "ring"
        ? [0, 0.12, 0.24, 0.36, 0.48, 0.6, 1.0, 1.12, 1.24, 1.36, 1.48, 1.6].map((o, i) => [o, i % 2 ? 1175 : 1480, 0.1])
        : [[0, 440, 1.2]];
    notes.forEach(([offset, f, len]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === "ring" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + offset);
      g.gain.exponentialRampToValueAtTime(kind === "ring" ? 0.5 : 0.15, now + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + len);
      o.connect(g).connect(ctx.destination);
      o.start(now + offset);
      o.stop(now + offset + len + 0.05);
      nodes.push(o);
      o.onended = () => nodes.splice(nodes.indexOf(o), 1);
    });
    if (kind === "ring") navigator.vibrate?.([500, 250, 500, 250, 500]);
  };
  play();
  timer = window.setInterval(play, kind === "ring" ? 3000 : 3000);
  return () => {
    if (timer) window.clearInterval(timer);
    navigator.vibrate?.(0);
    nodes.splice(0).forEach((o) => {
      try { o.stop(); } catch { /* already stopped */ }
    });
  };
}

export function useVoiceCall() {
  return useContext(VoiceCallContext);
}

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const me = user?.id ?? null;

  const [phase, setPhase] = useState<Phase>("idle");
  const [call, setCall] = useState<CallView | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callRef = useRef<CallView | null>(null);
  const phaseRef = useRef<Phase>("idle");
  callRef.current = call;
  phaseRef.current = phase;

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingIce.current = [];
    if (audioRef.current) audioRef.current.srcObject = null;
    setCall(null);
    setPhase("idle");
    setMuted(false);
    setSeconds(0);
  }, []);

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const getMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("voiceCall.noMic", "Microphone is not available in this browser"));
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    streamRef.current = stream;
    return stream;
  };

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    streamRef.current?.getTracks().forEach((tr) => pc.addTrack(tr, streamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) send("ice", { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (audioRef.current) {
        audioRef.current.srcObject = e.streams[0];
        void audioRef.current.play().catch(() => undefined);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPhase("connected");
      if (pc.connectionState === "failed") {
        toast({ variant: "destructive", description: t("voiceCall.failed", "The call could not connect") });
        const c = callRef.current;
        if (c) void endVoiceCall(c.id).catch(() => undefined);
        send("bye");
        cleanup();
      }
    };
    pcRef.current = pc;
    return pc;
  }, [cleanup, send, t, toast]);

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => undefined);
    pendingIce.current = [];
  };

  const joinChannel = useCallback(
    (callId: string, onReady?: () => void) => {
      const ch = supabase.channel(`call:${callId}`, {
        config: { private: true, broadcast: { self: false } },
      });
      ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
        const pc = pcRef.current ?? createPeer();
        await pc.setRemoteDescription(payload.sdp);
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send("answer", { sdp: pc.localDescription });
        setPhase("connecting");
      });
      ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(payload.sdp);
        await flushIce();
      });
      ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => undefined);
        else pendingIce.current.push(payload.candidate);
      });
      ch.on("broadcast", { event: "bye" }, () => cleanup());
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") onReady?.();
      });
      channelRef.current = ch;
    },
    [cleanup, createPeer, send],
  );

  const startCall = useCallback<VoiceCallContextValue["startCall"]>(
    async ({ threadId, peerId, peerName }) => {
      if (phaseRef.current !== "idle" || !me) return;
      setBusy(true);
      try {
        await getMic();
        const id = await startVoiceCall(peerId, threadId);
        const name = peerName ?? (await resolveName(peerId)) ?? "";
        setCall({ id, peerId, peerName: name, role: "caller" });
        setPhase("outgoing");
        await supabase.realtime.setAuth().catch(() => undefined);
        createPeer();
        joinChannel(id);
      } catch (err: any) {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        const msg: string = err?.message ?? String(err);
        toast({
          variant: "destructive",
          description: /already on another call/i.test(msg)
            ? t("voiceCall.busy", "This person is on another call. Try again later.")
            : msg,
        });
      } finally {
        setBusy(false);
      }
    },
    [createPeer, joinChannel, me, t, toast],
  );

  const showIncoming = useCallback(
    async (callId: string) => {
      if (phaseRef.current !== "idle" || !me) return;
      const row = await getVoiceCall(callId).catch(() => null);
      if (!row || row.status !== "ringing" || row.callee_id !== me) return;
      const name = (await resolveName(row.caller_id)) ?? "";
      setCall({ id: row.id, peerId: row.caller_id, peerName: name, role: "callee" });
      setPhase("incoming");
    },
    [me],
  );

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    setBusy(true);
    try {
      await getMic();
      await acceptVoiceCall(c.id);
      setPhase("connecting");
      await supabase.realtime.setAuth().catch(() => undefined);
      const pc = createPeer();
      joinChannel(c.id, async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send("offer", { sdp: pc.localDescription });
      });
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message ?? String(err) });
      await declineVoiceCall(c.id).catch(() => undefined);
      cleanup();
    } finally {
      setBusy(false);
    }
  };

  const hangUp = async () => {
    const c = callRef.current;
    if (!c) return;
    send("bye");
    const p = phaseRef.current;
    try {
      if (p === "incoming") await declineVoiceCall(c.id);
      else if (p === "outgoing") await cancelVoiceCall(c.id);
      else await endVoiceCall(c.id);
    } catch {
      /* already ended server-side */
    }
    cleanup();
  };

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((tr) => (tr.enabled = !next));
    setMuted(next);
  };

  // Incoming rings arrive as high-priority notifications.
  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`voice-ring-${me}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me}` },
        (payload) => {
          const row = payload.new as { source?: string; dedupe_key?: string | null };
          if (row.source !== "voice_call" || !row.dedupe_key?.startsWith("voice_call:")) return;
          void showIncoming(row.dedupe_key.slice("voice_call:".length));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [me, showIncoming]);

  // On load: pick up a ring that is already waiting (e.g. opened from a push),
  // and close any call left behind by a reload (its audio cannot be resumed).
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    void getActiveVoiceCall()
      .then((row) => {
        if (cancelled || !row || !isLiveStatus(row.status)) return;
        if (row.status === "ringing" && row.callee_id === me) void showIncoming(row.id);
        else void endVoiceCall(row.id).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me, showIncoming]);

  // Safety net: notice server-side endings (declined, missed, swept).
  useEffect(() => {
    if (!call) return;
    const id = window.setInterval(async () => {
      const row = await getVoiceCall(call.id).catch(() => null);
      if (row && !isLiveStatus(row.status)) {
        if (row.status === "declined" && call.role === "caller") toast({ description: t("voiceCall.declined", "Call declined") });
        if (row.status === "missed" && call.role === "caller") toast({ description: t("voiceCall.noAnswer", "No answer") });
        cleanup();
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [call, cleanup, t, toast]);

  // Ring / ringback while waiting.
  useEffect(() => {
    if (phase !== "incoming" && phase !== "outgoing") return;
    return startTone(phase === "incoming" ? "ring" : "ringback");
  }, [phase]);

  // Flash the tab title so an incoming call is visible from another tab.
  useEffect(() => {
    if (phase !== "incoming") return;
    const original = document.title;
    const alert = `📞 ${t("voiceCall.incomingTitle", "Incoming call")}`;
    let on = false;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? alert : original;
    }, 1000);
    return () => {
      window.clearInterval(id);
      document.title = original;
    };
  }, [phase, t]);

  // Keep-alive + timer while connected.
  useEffect(() => {
    if (phase !== "connected" || !call) return;
    const beat = window.setInterval(() => void heartbeatVoiceCall(call.id).catch(() => undefined), 30000);
    const tick = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      window.clearInterval(beat);
      window.clearInterval(tick);
    };
  }, [phase, call]);

  const statusText =
    phase === "incoming"
      ? t("voiceCall.incoming", "Incoming voice call")
      : phase === "outgoing"
        ? t("voiceCall.calling", "Calling…")
        : phase === "connecting"
          ? t("voiceCall.connecting", "Connecting…")
          : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <VoiceCallContext.Provider value={{ phase, inCall: phase !== "idle", startCall }}>
      {children}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {call && phase === "incoming" && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label={t("voiceCall.incomingTitle", "Incoming call")}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-gradient-to-b from-brand via-primary to-emerald-600 px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-primary-foreground"
        >
          <p className="text-sm font-semibold uppercase tracking-widest opacity-90">
            {t("voiceCall.incomingSub", "DARB · Incoming voice call")}
          </p>
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary-foreground/30 motion-safe:animate-ping" />
              <span className="absolute inset-3 rounded-full bg-primary-foreground/20 motion-safe:animate-pulse" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary-foreground text-5xl font-bold text-primary shadow-2xl">
                {peerIsAdmin ? <img src={darbLogoAsset.url} alt="DARB" className="h-full w-full rounded-full object-contain p-3" /> : (call.peerName || "?").charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold drop-shadow">{call.peerName || t("voiceCall.unknown", "Unknown")}</p>
              <p className="mt-2 text-lg opacity-90 motion-safe:animate-pulse">{t("voiceCall.incoming", "Incoming voice call")}…</p>
            </div>
          </div>
          <div className="flex w-full max-w-xs items-start justify-between">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={hangUp}
                disabled={busy}
                aria-label={t("voiceCall.decline", "Decline")}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl ring-4 ring-primary-foreground/40 transition active:scale-95 disabled:opacity-60"
              >
                <PhoneOff className="h-9 w-9" />
              </button>
              <span className="text-sm font-semibold">{t("voiceCall.decline", "Decline")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={accept}
                disabled={busy}
                aria-label={t("voiceCall.accept", "Accept")}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-primary-foreground shadow-2xl ring-4 ring-primary-foreground/40 transition active:scale-95 motion-safe:animate-bounce disabled:opacity-60"
              >
                <Phone className="h-9 w-9" />
              </button>
              <span className="text-sm font-semibold">{t("voiceCall.accept", "Accept")}</span>
            </div>
          </div>
        </div>
      )}
      {call && phase !== "idle" && phase !== "incoming" && (
        <div
          role="dialog"
          aria-live="assertive"
          aria-label={statusText}
          className="fixed inset-x-3 bottom-24 z-[100] mx-auto max-w-sm rounded-2xl border bg-card p-4 shadow-2xl md:bottom-6 md:end-6 md:inset-x-auto md:w-80"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {peerIsAdmin ? <img src={darbLogoAsset.url} alt="DARB" className="h-full w-full rounded-full bg-background object-contain p-1" /> : (call.peerName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{call.peerName || t("voiceCall.unknown", "Unknown")}</p>
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            {(
              <>
                {phase !== "outgoing" && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-full"
                    onClick={toggleMute}
                    aria-label={muted ? t("voiceCall.unmute", "Unmute") : t("voiceCall.mute", "Mute")}
                  >
                    {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={hangUp}
                  aria-label={t("voiceCall.hangUp", "Hang up")}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </VoiceCallContext.Provider>
  );
}
