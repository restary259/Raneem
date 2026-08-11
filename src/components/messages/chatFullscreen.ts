import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny global flag telling the dashboard shell that a mobile conversation is
 * mounted full-screen, so the bottom tab bar gets out of the way. A store (not
 * a context) keeps the chat pages free of provider plumbing through <Outlet/>.
 */
let mounted = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Reads the flag — used by the layout shell. */
export function useChatFullscreenActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mounted > 0,
    () => false,
  );
}

/** Declares a full-screen conversation while `active` is true. */
export function useChatFullscreen(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    mounted += 1;
    emit();
    return () => {
      mounted = Math.max(0, mounted - 1);
      emit();
    };
  }, [active]);
}
