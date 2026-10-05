import { useEffect, useRef } from "react";
import { useLocation } from "@/lib/router-compat";

/**
 * Restores the scroll offset of a scroll container across browser history
 * navigation (Back/Forward), keyed by the current route.
 *
 * Forward navigation (a fresh PUSH) starts at the top; returning to an entry the
 * user has already visited restores the offset they left it at, re-applying it
 * while an asynchronously-loaded list hydrates so the position is not clamped
 * away before the rows mount. A REPLACE (e.g. typing in a search box that syncs
 * the URL) keeps the current offset so the page does not jump.
 */
export function useScrollRestoration(
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  const location = useLocation();
  const key = location.key;
  const index = (location.state as { __TSR_index?: number } | null)
    ?.__TSR_index;
  const cache = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const prevIndex = useRef<number | undefined>(undefined);
  // Set while we programmatically move the container so the scroll listener
  // does not record our own restore frames as the user's position.
  const restoring = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (restoring.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => cache.current.set(key, el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [key, containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const previous = prevIndex.current;
    prevIndex.current = index;

    // Same history entry (REPLACE) — leave the offset where it is.
    if (index !== undefined && index === previous) return;

    const target = seen.current.has(key) ? cache.current.get(key) : undefined;

    restoring.current = true;
    el.scrollTo({ top: target ?? 0, left: 0, behavior: "auto" });

    if (target === undefined) {
      seen.current.add(key);
      restoring.current = false;
      return;
    }

    let attempts = 0;
    let frame = requestAnimationFrame(function apply() {
      el.scrollTop = target;
      attempts += 1;
      // Keep re-applying until the (possibly still-loading) content is tall
      // enough to hold the offset, or we give up after ~40 frames.
      if (Math.abs(el.scrollTop - target) > 1 && attempts < 40) {
        frame = requestAnimationFrame(apply);
      } else {
        restoring.current = false;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      restoring.current = false;
    };
  }, [key, index, containerRef]);
}
