

# Plan: Performance Optimization, PWA Install Button, and Admin Routing

## Overview

Optimize LCP, reduce bundle size, improve caching, add a fixed PWA install button (visible on all devices), and ensure admin email auto-redirects to the admin dashboard. The existing design, navigation order, and functionality will not change.

---

## 1. LCP Optimization

### 1a. Hero Video is the LCP Element

The Hero component loads a full HD video from Pexels as the background. This is the primary LCP bottleneck.

**Fix**: Add a static poster image to the video element so the browser renders a lightweight image immediately while the video loads in the background.

**In `src/components/landing/Hero.tsx`**:
- Add `poster="/lovable-uploads/[hero-poster].webp"` to the `<video>` tag
- Use an existing uploaded image or a screenshot from the video as the poster
- Add `fetchpriority="high"` to ensure the poster loads first

**In `index.html`**:
- Preload the poster image: `<link rel="preload" as="image" href="/lovable-uploads/[poster].webp">`

### 1b. Font Loading Optimization

Fonts are already preconnected. Additional fix:
- The `base.css` imports Google Fonts via `@import url(...)` which is render-blocking
- Remove the `@import` from `base.css` (line 2) since the same font is already loaded in `index.html` via `<link>` tag
- This eliminates a duplicate render-blocking request

### 1c. Remove Duplicate Loading Screens

Currently there are TWO loading screens:
1. `index.html` has a PWA loading screen (lines 123-131) that shows for 1 second
2. `App.tsx` has a `NetflixLoader` that shows for 2 seconds (line 80)

Users wait 2+ seconds before seeing any content. This directly hurts LCP.

**Fix**: Remove the React `NetflixLoader` entirely. Keep only the HTML loading screen (which hides automatically when the app loads). This saves ~2 seconds on LCP.

---

## 2. Bundle Size Reduction (Lazy Loading)

### 2a. Lazy-Load Route Pages

All 20+ page components are eagerly imported in `App.tsx`. Convert to lazy imports:

```tsx
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage'));
const InfluencerDashboardPage = lazy(() => import('./pages/InfluencerDashboardPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const AIAdvisorPage = lazy(() => import('./pages/AIAdvisorPage'));
const BroadcastPage = lazy(() => import('./pages/BroadcastPage'));
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage'));
const CurrencyConverterPage = lazy(() => import('./pages/CurrencyConverterPage'));
const BagrutCalculatorPage = lazy(() => import('./pages/BagrutCalculatorPage'));
const PartnershipPage = lazy(() => import('./pages/PartnershipPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const EducationalProgramsPage = lazy(() => import('./pages/EducationalProgramsPage'));
```

Keep eagerly loaded (used on first visit): `Index`, `WhoWeArePage`, `ServicesPage`, `ContactPage`, `EducationalDestinationsPage`, `LocationsPage`, `StudentAuthPage`, `NotFound`.

Wrap routes in `<Suspense fallback={<div />}>`.

### 2b. Vite Build Optimization

Add to `vite.config.ts`:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-supabase': ['@supabase/supabase-js'],
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
        'vendor-charts': ['recharts'],
      }
    }
  },
  target: 'esnext',
  minify: 'esbuild',
}
```

This splits the bundle into smaller cacheable chunks, reducing initial JS parse time.

---

## 3. CSS Optimization

### 3a. Remove Duplicate Font Import

`src/styles/base.css` line 2 has:
```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans:wght@400;700&display=swap');
```

This is a render-blocking CSS import that loads two additional font families (Noto Sans Arabic + Noto Sans) ON TOP of the Tajawal font already loaded in `index.html`. The body uses Noto Sans Arabic (base.css line 96) while index.html loads Tajawal.

**Fix**: Move this font loading to `index.html` as a `<link>` tag with `display=swap` (non-blocking), or consolidate to one font family. This saves ~400ms of render blocking.

---

## 4. Caching Improvements

### 4a. Update `public/_headers`

Add cache headers for static assets:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/lovable-uploads/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache
```

### 4b. Service Worker Already Handles Caching Well

The current service worker uses cache-first for static assets and network-first for navigation. No changes needed.

---

## 5. Fixed PWA Install Button (All Devices)

### Current Behavior
- Mobile only, delayed 15 seconds, dismissible via session storage
- Desktop users never see it

### New Behavior
- Fixed floating button visible on ALL devices (mobile + desktop)
- Bottom-right corner, clean rounded design
- Shows when `beforeinstallprompt` fires (Android/Desktop Chrome) or always on iOS
- On iOS: opens the share instructions modal
- Respects session dismissal
- Non-intrusive, small pill-shaped button

**Modify `src/components/common/PWAInstaller.tsx`**:
- Remove `if (!isMobile()) return;` check
- Change from corner card popup to a small floating pill button
- Show immediately when install prompt is available (remove 15s delay)
- Add desktop styling (slightly larger on desktop)
- Keep iOS modal for Safari users

---

## 6. Admin Auto-Redirect (Already Implemented)

The admin routing is already correctly implemented in `StudentAuthPage.tsx`:
- `redirectByRole()` checks `user_roles` table (server-side, not email-based)
- Admin role redirects to `/admin`
- Influencer role redirects to `/influencer-dashboard`
- Others go to `/student-dashboard`

**No changes needed** -- the current implementation uses proper server-side role validation via the `user_roles` table and `has_role` function, not client-side email checks. This is already secure.

---

## Technical Summary

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Remove `NetflixLoader`, add lazy imports + Suspense |
| `src/components/landing/Hero.tsx` | Add `poster` attribute to video |
| `src/styles/base.css` | Remove render-blocking `@import` on line 2 |
| `index.html` | Add font preload link for Noto Sans Arabic, add poster preload |
| `vite.config.ts` | Add build optimization (manual chunks, esbuild minify) |
| `public/_headers` | Add cache headers for assets |
| `src/components/common/PWAInstaller.tsx` | Make visible on all devices, change to floating pill button |

### What Will NOT Change

- Website design, navigation order, logo, or student portal button
- Service worker caching strategy
- Admin routing logic (already secure and role-based)
- SEO meta tags
- RTL/LTR support
- Any existing page content or layout

### Expected Performance Impact

| Metric | Current | After |
|--------|---------|-------|
| LCP | 3-5s | Less than 2.5s |
| Initial JS | All pages loaded | Only visible page loaded |
| Render blocking | Font @import + 2s loader | Eliminated |
| Repeat visit | Partial cache | Full immutable cache |
| PWA install | Mobile only, 15s delay | All devices, immediate |

