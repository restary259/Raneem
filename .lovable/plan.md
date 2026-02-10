Plan: Mobile Layout Fix, PWA Maintenance, Social Links, Content Updates

Overview
This plan addresses 5 priority areas: (1) mobile layout rendering fix for in-app browsers, (2) keep and harden PWA behavior with a lightweight install prompt, (3) Contact page social links fix, (4) Guides section original content, and (5) Locations description updates. A header navigation recommendation is provided separately at the end.

1. Mobile Layout Fix (TOP PRIORITY)

Goal: Website must render correctly on mobile screens when opened from Instagram, WhatsApp, or other in-app browsers — no horizontal scrolling, edge-to-edge layout.

Changes

index.html

Update viewport meta to:

<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">


This prevents in-app browsers from scaling incorrectly.

src/styles/base.css

Add to the html/body rules:

html {
  overflow-x: hidden;
  max-width: 100vw;
}
body {
  overflow-x: hidden;
  max-width: 100vw;
  -webkit-overflow-scrolling: touch;
}


Add a global overflow guard:

img, video, iframe, table, pre, code {
  max-width: 100%;
  box-sizing: border-box;
}


Ensure any component containers use width:100% and avoid fixed pixel widths exceeding viewport.

Notes for devs

Audit third-party embeds and iframes (Instagram embeds, video players) — wrap them in containers that enforce max-width:100% and aspect-ratio where possible.

Test inside common in-app browsers (Instagram, Facebook, WhatsApp, Telegram) on iOS and Android.

2. PWA Maintenance + Lightweight Install Prompt (KEEP PWA)

Change of approach: Do not delete PWA files. Keep the PWA active as a strategic channel for returning students, but harden and adjust it to avoid interfering with mobile layout or in-app rendering.

Files to KEEP (PWA)

public/service-worker.js — keep, but update caching strategy (see below)

public/manifest.json — keep and review icons and display settings

public/offline.html — keep as fallback

src/utils/pwaUtils.ts — keep, update as needed

src/hooks/usePWA.ts — keep

src/components/common/OfflineIndicator.tsx — keep but make unobtrusive

src/styles/pwa.css — keep but remove any layout overrides that cause horizontal overflow

Files / Code to MODIFY (PWA)

Goal: retain offline/install benefits while preventing layout or in-app rendering issues.

Service worker

Review cache rules: use a network-first for HTML/routes and cache-first for static assets (images, fonts), to avoid stale pages that render desktop CSS.

Ensure service worker does not inject or modify the page DOM at load time.

Add versioned cache names and an activation strategy that clears old caches safely.

manifest.json

Ensure display is appropriate (standalone or fullscreen if intentionally desired) — but avoid forcing standalone for all devices; keep prefer_related_applications: false.

Ensure icons include correct sizes and are optimized.

PWAInstaller component

Replace or update src/components/common/PWAInstaller.tsx to a small, non-intrusive corner popup (mobile only):

Small rounded card in the bottom-right (above BottomNav)

Shows Darb logo + "Install Darb" + native install button

Dismiss button (X) — dismissed state saved to sessionStorage

Only appears on mobile after 15 seconds

Uses the beforeinstallprompt event for Android/Chrome

For iOS show a brief tooltip instructing “Add to Home Screen” via Share → Add to Home Screen

No backdrop, no full-screen modal

Remove any PWA code that causes layout shifts

Remove or refactor any splash screen markup that causes width overflow (keep a minimal splash if needed, ensure it’s responsive).

Move safe-area utilities from pwa.css into base.css (safe area CSS is useful site-wide).

One-time cleanup for legacy clients

Instead of unregistering the SW globally, add a migration step: on first load after this deploy, the SW can compare cache version and clean old caches — do not unregister so users retain offline benefits.

Why keep the PWA: retention & engagement benefits (installable quick access for students), and offline resilience — valuable for students who rely on mobile data.

3. Contact Page Social Links Fix

File: src/components/landing/Contact.tsx

Action

Replace the broken social links with the exact working URLs from the Footer.

Mapping

Instagram → https://www.instagram.com/darb_studyingermany/

TikTok → https://www.tiktok.com/@darb_studyingermany

Facebook → https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/

Add WhatsApp (missing on Contact):

<a href="https://api.whatsapp.com/message/IVC4VCAEJ6TBD1" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors">
  <MessageCircle className="h-7 w-7" />
</a>


Import MessageCircle from lucide-react if not already imported.

Notes

Keep icons and styling identical to footer — only update link hrefs.

Test each link on mobile and confirm they open the expected app or web fallback.

4. Guides Section — Original Content (Written by Darb, localized)

Files: src/components/resources/GuidesReferences.tsx, src/pages/ResourcesPage.tsx, public/locales/ar/resources.json, public/locales/en/resources.json

Action

Replace placeholder external guides with original in-house articles targeted to Arab 48 students (Arabic first-person, professional tone).

Each article will be stored in the translation files (AR + EN) and rendered as expandable internal content (Accordion/Collapsible) — no external links.

New Guide Articles (6):

"الطريق إلى الجامعة الألمانية: دليل عملي لطلاب عرب 48" — Bagrut equivalency, Studienkolleg, uni-assist, timelines.

"تأشيرة الدراسة الألمانية خطوة بخطوة: من الموعد حتى الختم" — embassy appointments, blocked accounts, insurance (specific to Israeli passport holders).

"أول 30 يوم في ألمانيا: ما لا يقوله لك أحد" — Anmeldung, bank, SIM, transport, culture shock.

"اللغة الألمانية: من الصفر إلى B1 -- خطة واقعية" — language options, TestDaF/DSH prep, Arabic speaker tips.

"السكن الطلابي في ألمانيا: كيف تلاقي شقة بدون ما تجنّ" — Studentenwerk, WG-Gesucht, scams, city pricing.

"تكاليف المعيشة الحقيقية في ألمانيا 2025: ميزانية شهرية مفصّلة" — rent, food, transport, insurance, phone; city comparisons.

Technical approach

Add full article content into public/locales/ar/resources.json and public/locales/en/resources.json.

Update GuidesReferences.tsx to render each article as expandable cards (Accordion) or internal routes with anchors.

Remove external link buttons; replace with “اقرأ المزيد” expand behavior.

Tone + QA

Content must be original, localized, practical, and avoid AI-generic phrasing.

Proofread in Arabic (formal but relatable) and run a quick cultural review to ensure relevance to Arab 48 students.

5. Locations Description Update

Files: public/locales/ar/common.json and public/locales/en/common.json

Action

For every country except Germany, replace services description with:

Arabic: "خدمات جديدة ستتوفر قريباً."

English: "New services coming soon."

Countries to update

Jordan, Romania (and others except Germany). Italy is already correct.

6. Header Navigation Recommendation (NOT Applied)

(Kept identical to your previous recommendation; provide separately and DO NOT implement without approval.)

Recommended order (RTL / LTR aware):
Home | About Us (dropdown) | Our Services | Majors | Find Your Major | Resources | Contact Us | More (dropdown)

Rationale: builds trust and a guided student journey. Keep the recommendation for review only.

Technical Summary (UPDATED: PWA KEPT)

Files to KEEP (PWA)

public/service-worker.js (update caching strategy)

public/manifest.json

public/offline.html

src/utils/pwaUtils.ts

src/hooks/usePWA.ts

src/components/common/OfflineIndicator.tsx

src/styles/pwa.css (refactor to remove layout overrides)

Files to Modify

index.html — update viewport, remove layout-breaking PWA markup if present, keep manifest link.

src/App.tsx — keep PWA-related imports but remove any intrusive UI that causes layout shifts; keep OfflineIndicator if unobtrusive.

src/index.css — ensure no pwa css overrides remain (move safe-area to base.css).

src/styles/base.css — add overflow-x protection, safe-area utilities, max-width guards.

src/components/common/PWAInstaller.tsx — replace with lightweight corner popup as described.

src/components/landing/Contact.tsx — fix social links, add WhatsApp.

public/locales/ar/common.json & public/locales/en/common.json — update locations descriptions.

public/locales/ar/resources.json & public/locales/en/resources.json — add 6 original guides.

src/pages/ResourcesPage.tsx & src/components/resources/GuidesReferences.tsx — render expandable internal articles.

Files to DELETE

None of the PWA files should be deleted. (All previous delete recommendations are revoked.)

What Will NOT Change

Website design, colors, fonts, layout, or spacing (visuals remain identical)

Navigation order (logo, menu items, student portal button) unless explicitly approved

BottomNav mobile navigation

Component structure or visual hierarchy

Bilingual (AR/EN) support

AI chat, dashboards, tools, authentication

Final Notes for the Dev / Lovable Agent

Top priority: fix mobile layout when links are opened externally — test in multiple in-app browsers before moving to other tasks.

PWA kept: preserve offline/install benefits; make the PWA less intrusive and safe for in-app browsers. Do not unregister the service worker globally.

Provide a short QA checklist after changes: screenshots on iPhone Safari, iPhone Instagram in-app, Android Chrome, Android WhatsApp in-app; verify social links; verify install prompt behavior; verify Guides content renders properly as expandable cards.

If any visual change is unavoidable, pause and request approval before proceeding.