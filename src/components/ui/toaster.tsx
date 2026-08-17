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

// Tiny inline AudioContext beep — no external file needed.
// Plays a short soft chime on every new toast.
function playNotificationSound(variant?: string) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    // AudioContext blocked (user hasn't interacted yet) — silent fail.
  }
}

export function Toaster() {
  const { toasts } = useToast();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (toasts.length > prevCountRef.current) {
      // A new toast was added — play sound for it.
      const newest = toasts[toasts.length - 1];
      playNotificationSound(newest?.variant);
    }
    prevCountRef.current = toasts.length;
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
