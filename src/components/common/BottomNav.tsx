import React from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Home, Search, MessageCircle, User, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";

const BottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { dir } = useDirection();
  const isApply = location.pathname === "/apply";
  const isDashboard = ["/student-dashboard", "/admin", "/team-dashboard"].includes(location.pathname);
  if (!isMobile || isApply || isDashboard) return null;
  const navItems = [
    { name: t("bottomNav.home"), href: "/", icon: Home, ariaLabel: t("bottomNav.homeAria") },
    { name: t("bottomNav.majors"), href: "/educational-programs", icon: Search, ariaLabel: t("bottomNav.majorsAria") },
    { name: t("bottomNav.contact"), href: "/contact", icon: MessageCircle, ariaLabel: t("bottomNav.contactAria") },
    { name: t("bottomNav.apply", "Apply"), href: "/apply", icon: FileText, ariaLabel: t("bottomNav.applyAria", "Apply Now") },
    { name: t("bottomNav.account"), href: "/student-auth", icon: User, ariaLabel: t("bottomNav.accountAria") },
  ];
  return <nav role="navigation" aria-label={t("bottomNav.mainNav")} className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 py-2 shadow-[0_-8px_24px_-20px_hsl(var(--foreground)/0.35)] backdrop-blur-md md:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }} dir={dir}>
    <div className="mx-auto flex max-w-md items-center justify-around">
      {navItems.map((item) => { const Icon = item.icon; const active = location.pathname === item.href; return <Link key={item.href} to={item.href} aria-label={item.ariaLabel} className={`bottom-nav-item ${active ? "active" : ""}`}><Icon className={`mb-1.5 h-5 w-5 ${active ? "stroke-2" : "stroke-1.5"}`} aria-hidden="true" /><span className={`text-xs font-medium leading-tight truncate max-w-[60px] ${active ? "text-brand-strong" : "text-muted-foreground"}`}>{item.name}</span></Link>; })}
    </div>
  </nav>;
};

export default BottomNav;