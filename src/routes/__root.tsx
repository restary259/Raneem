/// <reference types="vite/client" />
// Root route — ports index.html (head metadata, splash, JSON-LD) and
// main.tsx/App.tsx provider nesting into TanStack Start.
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Suspense } from "react";
import appCss from "../styles.css?url";
import "@/i18n";
import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeScope from "@/components/common/ThemeScope";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import darbLogoShareAsset from "@/assets/darb-logo-share.jpg.asset.json";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif&family=Work+Sans:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans:wght@400;700&display=swap";

const APP_LOGO = darbLogoAsset.url;
const OG_IMAGE = `https://darb.agency${darbLogoShareAsset.url}`;
const BRAND_LOGO = `https://darb.agency${APP_LOGO}`;

const SITE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://darb.agency/#organization",
      name: "درب التعليمية",
      alternateName: "Darb Agency",
      url: "https://darb.agency/",
      logo: BRAND_LOGO,
    },
    {
      "@type": "WebSite",
      "@id": "https://darb.agency/#website",
      name: "درب التعليمية",
      url: "https://darb.agency/",
      inLanguage: "ar",
      publisher: { "@id": "https://darb.agency/#organization" },
    },
  ],
});

const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "درب للدراسة في الخارج",
  alternateName: "Darb Study Pathways",
  url: "https://darb.agency",
  logo: BRAND_LOGO,
  description: "Education consultancy agency helping Arab students study in Germany",
  sameAs: [
    "https://www.instagram.com/darb_studyingermany/",
    "https://www.tiktok.com/@darb_studyingrmany",
    "https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["Arabic", "English", "German"],
  },
});

// LCP hero preload — only the landing route renders the hero.
const HERO_PRELOAD_SCRIPT = `
if (location.pathname === '/' || location.pathname === '/index.html') {
  var heroPreload = document.createElement('link');
  heroPreload.rel = 'preload';
  heroPreload.as = 'image';
  heroPreload.href = '/lovable-uploads/hero-poster.webp';
  heroPreload.setAttribute('fetchpriority', 'high');
  document.head.appendChild(heroPreload);
}`;

// Splash fallback — AppShell hides it on mount; this covers a stalled boot.
const SPLASH_FALLBACK_SCRIPT = `
setTimeout(function () {
  var loading = document.getElementById('pwa-loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(function () { loading.remove(); }, 500);
  }
}, 10000);`;

const SPLASH_CSS = `
.pwa-loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #ffffff; display: flex; align-items: center; justify-content: center; z-index: 9999; color: #1a1a2e; font-family: 'Tajawal', sans-serif; opacity: 1; transition: opacity 0.5s ease; }
.pwa-loading.hidden { opacity: 0; pointer-events: none; }
.pwa-loading .loading-content { text-align: center; max-width: 300px; }
.pwa-loading .loading-logo { width: 112px; height: 112px; margin: 0 auto 1rem; animation: pwa-pulse 2s infinite; }
.pwa-loading .loading-logo img { width: 100%; height: 100%; object-fit: contain; }
@keyframes pwa-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
.pwa-loading .loading-text { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
.pwa-loading .loading-subtitle { font-size: 1rem; opacity: 0.8; }
body { padding-bottom: env(safe-area-inset-bottom, 0); }
`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "google-site-verification", content: "COTgmDj38LXAvG5QZ8jEBHDXxC9vIxknsLLa0KUjp-E" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { title: "درب | الدراسة في ألمانيا بدعم عربي" },
      {
        name: "description",
        content:
          "درب ترافق الطلاب العرب إلى الدراسة في ألمانيا: تقييم الملف، التقديم، تجهيز التأشيرة، السكن، والمتابعة حتى الوصول.",
      },
      { name: "author", content: "Darb Study Pathways" },
      {
        name: "keywords",
        content: "دراسة في الخارج، جامعات، تعليم، استشارات تعليمية، تأشيرة طالب، سكن طلابي",
      },
      { httpEquiv: "Content-Security-Policy", content: "upgrade-insecure-requests" },
      // PWA
      { name: "theme-color", content: "#F28C28" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "درب" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "درب" },
      // Open Graph
      { property: "og:title", content: "درب | الدراسة في ألمانيا بدعم عربي" },
      {
        property: "og:description",
        content:
          "من تقييم الملف إلى التقديم والتأشيرة والسكن—درب ترافق الطلاب العرب خطوة بخطوة نحو الدراسة في ألمانيا.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:url", content: "https://darb.agency/" },
      { property: "og:site_name", content: "درب التعليمية" },
      { property: "og:locale", content: "ar_AR" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@darb_education" },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:title", content: "درب | الدراسة في ألمانيا بدعم عربي" },
      {
        name: "twitter:description",
        content:
          "من تقييم الملف إلى التقديم والتأشيرة والسكن—درب ترافق الطلاب العرب خطوة بخطوة نحو الدراسة في ألمانيا.",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json", crossOrigin: "use-credentials" },
      { rel: "icon", href: "/favicon-v2.png", type: "image/png", sizes: "64x64" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon-v2.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS_HREF },
      { rel: "canonical", href: "https://darb.agency/" },
      { rel: "dns-prefetch", href: "//fonts.googleapis.com" },
      { rel: "dns-prefetch", href: "//fonts.gstatic.com" },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      { children: HERO_PRELOAD_SCRIPT },
      { type: "application/ld+json", children: SITE_JSONLD },
      { type: "application/ld+json", children: ORG_JSONLD },
      { children: SPLASH_FALLBACK_SCRIPT },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <NotFound />,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      </head>
      <body>
        {/* PWA splash — hidden by AppShell once React mounts */}
        <div id="pwa-loading" className="pwa-loading">
          <div className="loading-content">
            <div className="loading-logo">
              <img src={APP_LOGO} alt="درب" />
            </div>
            <div className="loading-text">درب</div>
            <div className="loading-subtitle">رفيقك الدراسي العالمي</div>
          </div>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <ThemeScope>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeScope>
      </Suspense>
    </ErrorBoundary>
  );
}

function RootErrorComponent({ error }: { error: Error }) {
  if (typeof window !== "undefined") {
    reportLovableError(error);
  }
  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Tajawal', sans-serif", padding: "2rem", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>حدث خطأ غير متوقع</h1>
        <p style={{ opacity: 0.8, marginBottom: "1rem" }}>نعتذر عن الإزعاج — حاول تحديث الصفحة.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#F28C28", color: "#fff", border: 0, borderRadius: 8, padding: "0.6rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}
        >
          تحديث الصفحة
        </button>
      </div>
    </div>
  );
}
