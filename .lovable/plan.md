
# Plan: Security Hardening, Mobile Responsiveness, SEO Optimization + PWA Install Prompt

## Overview

This plan addresses four areas: (1) security headers and HTTPS enforcement, (2) mobile responsiveness fixes for in-app browsers, (3) comprehensive SEO optimization across all pages, and (4) ensuring the PWA install prompt works correctly. The existing design, layout, and visual hierarchy will not be changed.

---

## 1. Security / HTTPS Hardening

### What needs to happen

The site is hosted on Lovable Cloud which already serves over HTTPS with a valid SSL certificate. However, we can add security headers and eliminate mixed content risks.

**Create `public/_headers` file** (Netlify/Lovable compatible):
```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: upgrade-insecure-requests
```

**Audit and fix mixed content**:
- The Hero component loads a video from `https://videos.pexels.com/...` -- already HTTPS, OK
- All image assets use relative paths (`/lovable-uploads/...`) -- OK
- Google Fonts loaded via HTTPS -- OK
- No mixed content issues found in the codebase

**`index.html`** -- Add meta tag for HTTPS upgrade:
```html
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
```

---

## 2. Mobile Responsiveness (Critical Fix)

The viewport and overflow rules are already partially in place from prior work. This phase verifies and hardens them.

### Already in place (from previous work):
- `overflow-x: hidden` and `max-width: 100vw` on `html` and `body` in `base.css`
- `img, video, iframe` constrained to `max-width: 100%`
- Viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover`
- Fluid typography with `clamp()` values
- Safe-area utilities

### Additional fixes needed:

**`src/styles/base.css`** -- Add touch-action constraint to prevent horizontal panning:
```css
html {
  touch-action: pan-y pinch-zoom;
}
```

**`src/components/landing/DesktopNav.tsx`** -- The nav list has `overflow-x-auto` which could cause horizontal scrolling on narrow viewports. This is hidden on mobile (`hidden md:block` in Header), so it's safe. No change needed.

**`src/components/landing/PartnersMarquee.tsx`** -- Verify marquee animation doesn't cause overflow. Add `overflow: hidden` wrapper if needed.

**`src/App.css`** -- This file contains legacy Vite boilerplate (`#root { max-width: 1280px; padding: 2rem; }`) that could restrict layout width. Clean it up or remove conflicting rules.

---

## 3. SEO Optimization

### 3a. Per-page meta tags using a reusable SEO component

**Create `src/components/common/SEOHead.tsx`**:
A component that sets `document.title` and manages meta description via `useEffect`. React Helmet is not in deps and unnecessary -- a simple hook approach works.

```tsx
const SEOHead = ({ title, description }: { title: string; description: string }) => {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', description);
    return () => { document.title = 'درب | رفيقك الدراسي العالمي'; };
  }, [title, description]);
  return null;
};
```

**Add SEOHead to every page** with unique titles and descriptions:

| Page | Title (AR) | Description |
|------|-----------|-------------|
| Index | درب - رفيقك الدراسي العالمي للدراسة في ألمانيا | استشارات تعليمية، قبولات جامعية، تأشيرات، سكن... |
| About | من نحن - درب للدراسة في الخارج | تعرف على فريق درب ورؤيتنا... |
| Services | خدماتنا - درب للدراسة في ألمانيا | خدمات شاملة من القبول حتى الوصول... |
| Contact | تواصل معنا - درب | تواصل مع درب للاستشارة المجانية... |
| Partnership | كن وكيلاً - اربح مع درب | انضم لشبكة وكلاء درب... |
| Resources | أدلة ومراجع - درب | أدلة عملية للطلاب العرب... |
| Educational Destinations | وجهات تعليمية - درب | اكتشف الجامعات والبرامج... |
| Educational Programs | التخصصات - درب | تصفح التخصصات المتاحة... |
| Quiz | اختيار التخصص - درب | اكتشف التخصص المناسب لك... |
| AI Advisor | المستشار الذكي - درب | تحدث مع مستشار درب الذكي... |

English versions will also be provided via i18n translation keys.

### 3b. XML Sitemap

**Create `public/sitemap.xml`** with all public routes:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://darb-agency.lovable.app/</loc><priority>1.0</priority></url>
  <url><loc>https://darb-agency.lovable.app/about</loc><priority>0.8</priority></url>
  <url><loc>https://darb-agency.lovable.app/services</loc><priority>0.9</priority></url>
  <url><loc>https://darb-agency.lovable.app/contact</loc><priority>0.9</priority></url>
  <url><loc>https://darb-agency.lovable.app/partnership</loc><priority>0.7</priority></url>
  <url><loc>https://darb-agency.lovable.app/educational-destinations</loc><priority>0.8</priority></url>
  <url><loc>https://darb-agency.lovable.app/educational-programs</loc><priority>0.8</priority></url>
  <url><loc>https://darb-agency.lovable.app/resources</loc><priority>0.7</priority></url>
  <url><loc>https://darb-agency.lovable.app/quiz</loc><priority>0.7</priority></url>
  <url><loc>https://darb-agency.lovable.app/ai-advisor</loc><priority>0.6</priority></url>
  <url><loc>https://darb-agency.lovable.app/broadcast</loc><priority>0.5</priority></url>
</urlset>
```

### 3c. Update `public/robots.txt`

Add sitemap reference:
```
User-agent: *
Allow: /
Disallow: /student-dashboard
Disallow: /admin
Disallow: /reset-password

Sitemap: https://darb-agency.lovable.app/sitemap.xml
```

### 3d. Structured Data (JSON-LD)

**Add to `index.html`** -- Organization schema:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "درب للدراسة في الخارج",
  "alternateName": "Darb Study Pathways",
  "url": "https://darb-agency.lovable.app",
  "logo": "https://darb-agency.lovable.app/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png",
  "description": "Education consultancy agency helping Arab students study in Germany",
  "sameAs": [
    "https://www.instagram.com/darb_studyingermany/",
    "https://www.tiktok.com/@darb_studyingrmany",
    "https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": ["Arabic", "English", "German"]
  }
}
</script>
```

### 3e. Image alt text audit

Most images already have alt attributes. Verify and add missing alt text to:
- Partner logos in `PartnersMarquee`
- Student gallery images in `StudentGallery`
- Any decorative images should get `alt=""`

---

## 4. PWA Install Prompt (Already Working)

The PWA install prompt is already implemented as a non-intrusive corner popup (`PWAInstaller.tsx`):
- Mobile only, appears after 15 seconds
- Small corner card with dismiss button
- iOS modal with share instructions
- Session-based dismissal

**No changes needed** -- it's already functional. The service worker, manifest, and install prompt are all in place.

### Minor PWA cleanup:

**`src/App.css`** -- Remove legacy Vite boilerplate that's not used:
```css
/* Remove #root { max-width: 1280px; padding: 2rem; } */
/* This conflicts with full-width layout */
```

**`src/components/common/OfflineIndicator.tsx`** -- Localize the hardcoded Arabic text:
Replace `"غير متصل بالإنترنت - تستخدم النسخة المحفوظة محلياً"` with `t('offline.message')` and add translation keys.

---

## 5. Clean Up Legacy Code

**`src/App.css`** -- This file contains Vite boilerplate CSS that's unused and potentially harmful:
- `#root { max-width: 1280px; padding: 2rem; }` -- forces max-width constraint
- `.logo`, `.card`, `.read-the-docs` -- unused classes

Action: Clear this file completely or remove conflicting rules. The actual styles are in `src/styles/base.css`.

**`vercel.json`** -- Contains a malformed git command prepended to the JSON. Fix to valid JSON:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

---

## Technical Summary

### New Files
| File | Purpose |
|------|---------|
| `public/_headers` | Security headers (HSTS, X-Frame-Options, etc.) |
| `public/sitemap.xml` | XML sitemap for search engines |
| `src/components/common/SEOHead.tsx` | Reusable per-page SEO component |

### Files to Modify
| File | Changes |
|------|---------|
| `index.html` | Add CSP meta tag, JSON-LD structured data |
| `public/robots.txt` | Add sitemap URL, disallow private routes |
| `src/styles/base.css` | Add `touch-action: pan-y pinch-zoom` to html |
| `src/App.css` | Remove Vite boilerplate (conflicting max-width/padding) |
| `vercel.json` | Fix malformed JSON |
| `src/components/common/OfflineIndicator.tsx` | Localize hardcoded Arabic text |
| All page components (10+) | Add `<SEOHead>` with unique title/description |

### Files to Add Translation Keys
| File | Keys |
|------|------|
| `public/locales/ar/common.json` | `seo.*` keys for all page titles/descriptions, `offline.message` |
| `public/locales/en/common.json` | Same keys in English |

### What Will NOT Change
- Website design, colors, fonts, layout, or spacing
- Navigation order (logo, menu items, student portal button)
- BottomNav mobile navigation
- Component structure or visual hierarchy
- PWA functionality (kept and working)
- Bilingual (AR/EN) support
- AI chat, dashboards, tools, authentication
