import { useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// Single reused AudioContext — browsers cap concurrent contexts (~6 in Chrome),
// so creating one per toast would exhaust the pool and silently kill later beeps.
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctor();
    }
    return audioCtx;
  } catch {
    // AudioContext blocked (user hasn't interacted yet) — silent fail.
    return null;
  }
}

// Tiny inline beep — no external file needed. Plays a short soft chime on every new toast.
function playNotificationSound(variant?: string) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    // Destructive toasts → lower, duller tone. Others → bright chime.
    oscillator.frequency.value = variant === "destructive" ? 300 : 880;
    oscillator.type = "sine";

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.35);
  } catch {
    // Suspended/blocked context — silent fail.
  }
}

export function Toaster() {
  const { toasts } = useToast();
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    // ADD_TOAST prepends, so index 0 is the newest. Track the id (not the
    // count) because the store caps at TOAST_LIMIT=1 and replaces in place —
    // a length check would miss rapid successive toasts.
    const newest = toasts[0];
    if (newest && newest.id !== prevIdRef.current) {
      playNotificationSound(newest.variant);
    }
    prevIdRef.current = newest?.id ?? null;
  }, [toasts]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} duration={2000} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
