import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, forwardedRef) => {
  // Portaled to document.body — inside a modal Dialog, react-remove-scroll
  // preventDefaults wheel/touchmove outside the dialog, which would make this
  // popover unscrollable. Stopping propagation keeps native scrolling working
  // (wheel + touch) without unlocking the page behind. Same fix as select.tsx.
  // Attached in the ref callback because Radix mounts the node lazily on open.
  const detachRef = React.useRef<(() => void) | null>(null);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={(node) => {
          detachRef.current?.();
          detachRef.current = null;
          if (node) {
            const stop = (e: Event) => e.stopPropagation();
            node.addEventListener("wheel", stop);
            node.addEventListener("touchmove", stop);
            detachRef.current = () => {
              node.removeEventListener("wheel", stop);
              node.removeEventListener("touchmove", stop);
            };
          }
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
