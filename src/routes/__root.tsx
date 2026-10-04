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
import appCss from "../styles.css?url";
import "@/i18n";
import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeScope from "@/components/common/ThemeScope";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { DARB_OFFICE } from "@/config/localBusiness";
import darbLogoAsset from "@/assets/darb-logo-2026.png.asset.json";
import darbLogoShareAsset from "@/assets/darb-logo-share.jpg.asset.json";

// One request per script actually used: Inter (Latin/UI), IBM Plex Sans
// Arabic (ar), Noto Sans Hebrew (he). Instrument Serif + Noto Naskh Arabic
// back the optional `font-editorial` accent used on landing/page heroes.
// Every family here is referenced by src/styles.css — keep them in sync.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans+Hebrew:wght@400;500;600;700&family=Instrument+Serif&family=Noto+Naskh+Arabic:wght@600;700&display=swap";

const APP_LOGO = darbLogoAsset.url;
const OG_IMAGE = `https://darb.agency${darbLogoShareAsset.url}`;
const BRAND_LOGO = `https://darb.agency${APP_LOGO}`;

const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://darb.agency/#organization",
      name: "درب للتعليم الدولي",
      alternateName: "Darb Study International",
      url: "https://darb.agency/",
      logo: BRAND_LOGO,
    },
    {
      "@type": "WebSite",
      "@id": "https://darb.agency/#website",
      name: "درب للتعليم الدولي",
      url: "https://darb.agency/",
      inLanguage: "ar",
      publisher: { "@id": "https://darb.agency/#organization" },
    },
  ],
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": "https://darb.agency/#educational-organization",
  name: "درب للتعليم الدولي",
  alternateName: "Darb Study International",
  url: "https://darb.agency",
  logo: BRAND_LOGO,
  description:
    "Education consultancy agency helping Arab students study in Germany",
  sameAs: [
    "https://www.instagram.com/darb_studyingermany/",
    "https://www.tiktok.com/@darb_studyingrmany",
    "https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/",
  ],
  // Local-entity signals so an Arabic-speaking Israeli audience can be matched
  // geographically. Sourced from DARB_OFFICE / contactConfig to avoid drift.
  address: {
    "@type": "PostalAddress",
    streetAddress: DARB_OFFICE.streetAddress,
    addressLocality: DARB_OFFICE.addressLocality,
    postalCode: DARB_OFFICE.postalCode,
    addressCountry: DARB_OFFICE.addressCountry,
  },
  telephone: DARB_OFFICE.telephone,
  areaServed: [
    { "@type": "Country", name: "Israel" },
    { "@type": "Country", name: "Germany" },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: DARB_OFFICE.telephone,
    areaServed: "IL",
    availableLanguage: ["Arabic", "Hebrew", "English", "German"],
  },
};

/**
 * Physical office presence, linked back to the organization so the local
 * entity is unambiguously tied to the parent business.
 */
const LOCAL_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://darb.agency/locations#tamra",
  name: DARB_OFFICE.nameEn,
  alternateName: DARB_OFFICE.nameAr,
  url: "https://darb.agency/locations",
  image: OG_IMAGE,
  telephone: DARB_OFFICE.telephone,
  parentOrganization: {
    "@id": "https://darb.agency/#educational-organization",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: DARB_OFFICE.streetAddress,
    addressLocality: DARB_OFFICE.addressLocality,
    postalCode: DARB_OFFICE.postalCode,
    addressCountry: DARB_OFFICE.addressCountry,
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [...DARB_OFFICE.openingHours.daysOfWeek],
    opens: DARB_OFFICE.openingHours.opens,
    closes: DARB_OFFICE.openingHours.closes,
  },
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      scripts: [SITE_JSONLD, ORG_JSONLD, LOCAL_JSONLD].map((value) => ({
        type: "application/ld+json",
        children: JSON.stringify(value),
      })),
      meta: [
        { charSet: "UTF-8" },
        {
          name: "google-site-verification",
          content: "COTgmDj38LXAvG5QZ8jEBHDXxC9vIxknsLLa0KUjp-E",
        },
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
        { name: "author", content: "Darb Study International" },
        {
          name: "keywords",
          content:
            "دراسة في الخارج، جامعات، تعليم، استشارات تعليمية، تأشيرة طالب، سكن طلابي",
        },
        {
          httpEquiv: "Content-Security-Policy",
          // Do NOT add script-src here: TanStack Start hydrates from an inline
          // bootstrap script (window.$_TSR). A meta script-src without a
          // per-request nonce blocks it and the app renders a blank screen.
          content: "upgrade-insecure-requests",
        },
        // PWA
        { name: "theme-color", content: "#082B66" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "درب" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "application-name", content: "درب للتعليم الدولي" },
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
        { property: "og:site_name", content: "درب للتعليم الدولي" },
        { property: "og:locale", content: "ar_AR" },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@darb_education" },
        { name: "twitter:image", content: OG_IMAGE },
        {
          name: "twitter:title",
          content: "درب | الدراسة في ألمانيا بدعم عربي",
        },
        {
          name: "twitter:description",
          content:
            "من تقييم الملف إلى التقديم والتأشيرة والسكن—درب ترافق الطلاب العرب خطوة بخطوة نحو الدراسة في ألمانيا.",
        },
      ],
      links: [
        {
          rel: "manifest",
          href: "/manifest.json",
          crossOrigin: "use-credentials",
        },
        {
          rel: "icon",
          href: "/favicon-v2.png",
          type: "image/png",
          sizes: "64x64",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon-v2.png",
        },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        { rel: "stylesheet", href: FONTS_HREF },
        { rel: "dns-prefetch", href: "//fonts.googleapis.com" },
        { rel: "dns-prefetch", href: "//fonts.gstatic.com" },
        { rel: "stylesheet", href: appCss },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: () => <NotFound />,
    errorComponent: RootErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
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
      <ThemeScope>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeScope>
    </ErrorBoundary>
  );
}

function RootErrorComponent({ error }: { error: unknown }) {
  if (typeof window !== "undefined") {
    reportLovableError(error instanceof Error ? error : new Error(String(error)));
  }
  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-arabic)",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          حدث خطأ غير متوقع
        </h1>
        <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
          نعتذر عن الإزعاج — حاول تحديث الصفحة.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#F28C28",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "0.6rem 1.4rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          تحديث الصفحة
        </button>
      </div>
    </div>
  );
}
