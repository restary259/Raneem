import * as React from "react";

/**
 * Safety net against a stuck `body { pointer-events: none }` after a modal
 * (Dialog / Sheet / AlertDialog) closes.
 *
 * Radix sets `pointer-events: none` on <body> while a modal layer is open and
 * restores it when the last layer unmounts. If two *different copies* of
 * `@radix-ui/react-dismissable-layer` end up installed (e.g. a nested modal
 * dropdown resolves a different copy than the dialog), each copy keeps its own
 * layer registry and one of them can restore the stale "none" value — freezing
 * the whole page until refresh. The dependency tree is deduped in package.json
 * (`overrides`), and this hook guards against future drift: once a modal has
 * closed and no other Radix modal layer remains, clear the leftover style.
 */
export function useModalPointerEventsGuard(open: boolean | undefined) {
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (typeof document === "undefined") return;
    // Wait for the exit animation + Radix's own cleanup to finish first.
    const id = window.setTimeout(() => {
      const anotherModalOpen = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-state="open"][role="listbox"], [data-state="open"][role="menu"]',
      );
      if (!anotherModalOpen && document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [open]);
}
