import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, X } from "lucide-react";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/router-compat";

const WhatsAppFloatingButton = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const path = location.pathname;
  const hidden = path === "/apply" || path === "/team-dashboard" || path === "/student-dashboard" || ["/admin", "/partner", "/agent", "/team", "/student"].some((p) => path === p || path.startsWith(`${p}/`));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("scroll", close, { passive: true, once: true });
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", close);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (hidden) return null;
  return (
    <div className="whatsapp-side-tab fixed end-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 md:bottom-8">
      {open ? <div ref={panelRef} role="dialog" aria-label={t("whatsapp.panelTitle")} className="mb-2 me-3 w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-4 text-foreground shadow-surface-lg animate-scale-in motion-reduce:animate-none">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-bold text-primary">{t("whatsapp.panelTitle")}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-status-paid" />{t("whatsapp.verified")}</p></div>
          <Button type="button" size="icon-sm" variant="ghost" className="-me-2 -mt-2" onClick={() => setOpen(false)} aria-label={t("whatsapp.close")}><X /></Button>
        </div>
        <Button asChild className="mt-4 w-full"><a href={whatsappBusinessUrl("مرحبا، بدي أعرف أكثر عن الدراسة بألمانيا مع درب.")} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("whatsapp.confirm")}</a></Button>
      </div> : null}
      <Button ref={triggerRef} type="button" size="icon" aria-expanded={open} aria-label={t("whatsapp.floatingLabel")} className="ms-auto rounded-e-none bg-trust text-primary-foreground shadow-surface hover:bg-trust/90" onClick={() => setOpen((value) => !value)}><MessageCircle /></Button>
    </div>
  );
};

export default WhatsAppFloatingButton;