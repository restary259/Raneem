import React from "react";
import { MessageCircle } from "lucide-react";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useTranslation } from "react-i18next";

const WhatsAppFloatingButton = () => {
  const { t } = useTranslation();
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const hidden = path === "/apply" || path === "/team-dashboard" || path === "/student-dashboard" || ["/admin", "/partner", "/agent", "/team", "/student"].some((p) => path === p || path.startsWith(`${p}/`));
    if (hidden) return null;
  }
  return (
    <a
      href={whatsappBusinessUrl("مرحبا، بدي أعرف أكثر عن الدراسة بألمانيا مع درب.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.floatingLabel", "Chat with us on WhatsApp")}
      className="fixed end-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex w-10 flex-col items-center gap-2 rounded-s-xl border-y border-s border-border bg-trust px-2 py-3 text-xs font-semibold text-primary-foreground shadow-surface transition-colors hover:bg-trust/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none md:bottom-8 md:w-11"
    >
      <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
      <span className="[writing-mode:vertical-rl]">{t("whatsapp.sideTab", "WhatsApp")}</span>
    </a>
  );
};

export default WhatsAppFloatingButton;