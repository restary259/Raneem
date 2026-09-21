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
  return <a href={whatsappBusinessUrl("مرحبا، بدي أعرف أكثر عن الدراسة بألمانيا مع درب.")} target="_blank" rel="noopener noreferrer" aria-label={t("whatsapp.floatingLabel", "Chat with us on WhatsApp")} className="fixed end-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex min-h-11 items-center gap-2 rounded-s-full border-y border-s border-[hsl(160_68%_42%)] bg-trust px-3 py-2 text-xs font-semibold text-primary-foreground shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 motion-reduce:transition-none"><MessageCircle className="size-4 shrink-0" aria-hidden="true" /><span className="hidden sm:inline">{t("whatsapp.sideTab", "WhatsApp")}</span></a>;
};

export default WhatsAppFloatingButton;