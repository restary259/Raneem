

# Security Fixes + Performance Optimization Plan

## Overview

This plan addresses three categories: RLS policy gaps, leaked password protection, and Lighthouse performance improvements.

---

## Part 1: Database Security (RLS Policies)

### A. login_attempts -- Allow Edge Function Inserts

**Problem:** The `login_attempts` table has no INSERT policy. The `auth-guard` edge function uses the service role key to insert, which bypasses RLS entirely. This actually works today -- service role bypasses all RLS. No policy change is strictly needed, but we should formalize this.

**Action:** No migration needed. The service role key already bypasses RLS. The current design is correct -- only the `auth-guard` edge function (using service role) writes to this table. Adding an anon/authenticated INSERT policy would be a security regression.

**Status:** Already secure. No change required.

### B. contact_submissions -- Allow Anonymous Inserts

**Problem:** No INSERT policy exists. The `send-email` edge function uses service role to insert contact submissions, so it works. But to be explicit and clean:

**Action:** No migration needed. The `send-email` edge function uses service role key, which bypasses RLS. The contact form is already rate-limited (3/hour per IP) with honeypot protection. Adding an anon INSERT policy would be less secure than the current approach (edge function with validation).

**Status:** Already secure. No change required.

### C. Push Notification Function -- Fix User ID Validation

**Problem (CRITICAL):** The `push-notify` edge function allows subscribing/unsubscribing ANY user_id without verifying the caller matches. This is an actual vulnerability.

**Action:** Update `supabase/functions/push-notify/index.ts` to:
1. Extract JWT from Authorization header
2. Validate the authenticated user matches the `user_id` parameter for subscribe/unsubscribe actions
3. For "send" action, verify admin role

### D. Admin Storage Access

**Action:** Add a database migration with storage policies allowing admins to SELECT (and optionally DELETE) files in the `student-documents` bucket.

```sql
CREATE POLICY "Admins can view all student documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-documents' AND public.has_role(auth.uid(), 'admin'));
```

---

## Part 2: Leaked Password Protection

**Problem:** The Supabase linter confirms leaked password protection is disabled.

**Action:** Use the Lovable Cloud auth configuration tool to enable leaked password protection. This is a backend setting, not a code change. Once enabled, signup/login will reject passwords found in known breach databases.

---

## Part 3: Performance Optimizations

### A. Eliminate Redirect Chain

**Current:** The SPA redirect logic in `App.tsx` (lines 57-65) reads `sessionStorage.redirectPath` and navigates. This is necessary for SPA routing on static hosts and is not a true redirect chain -- it's a client-side navigation. The `vercel.json` and `public/404.html` handle this correctly.

**Action:** No change needed. The current implementation is the standard SPA fallback pattern.

### B. Improve LCP (Largest Contentful Paint)

**Current state:**
- Hero poster is already preloaded: `<link rel="preload" as="image" href="/lovable-uploads/hero-poster.webp">` (good)
- Hero video has poster attribute set (good)
- Font is preloaded (good)

**Action:** Add `fetchpriority="high"` to the hero poster preload link in `index.html`.

### C. Reduce Render-Blocking Resources (~160ms savings)

**Problem:** Two Google Fonts CSS files are render-blocking.

**Action:**
1. Change the Noto Sans font `<link>` to use `media="print" onload="this.media='all'"` pattern for non-critical font
2. Keep Tajawal (primary font) preloaded but ensure `display=swap` is in the URL (already present)

### D. Optimize JavaScript Chunking (~117 KiB unused JS savings)

**Current chunks:** vendor-react, vendor-supabase, vendor-charts

**Action:** Add more granular manual chunks in `vite.config.ts`:
```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-charts': ['recharts'],
  'vendor-i18n': ['i18next', 'react-i18next', 'i18next-http-backend'],
  'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
  'vendor-date': ['date-fns'],
}
```

Also ensure these are not eagerly imported:
- `mapbox-gl` -- only used on Locations page (already lazy-loaded via page)
- `@react-three/fiber` -- verify it's only loaded where needed

### E. Reduce Unused CSS (~14 KiB savings)

**Action:** Tailwind CSS purging is already configured by default in Vite + Tailwind. The savings come from:
1. Removing the PWA loading screen inline styles from `index.html` (move to a small external CSS or reduce)
2. Ensure `tailwind.config.ts` content paths are correct

No major action needed -- Tailwind already purges unused classes in production builds.

### F. Improve Caching Headers (~5 MB savings)

**Current `_headers`:**
- `/*` has `Cache-Control: no-store` (too aggressive for all routes)
- `/assets/*` has `immutable` (good)
- `/lovable-uploads/*` has `immutable` (good)

**Action:** Update `public/_headers`:
- Keep `no-store` only for `/index.html`
- Add caching for font files: `/fonts/*` with `public, max-age=31536000, immutable`
- Remove the global `no-store` and replace with a more targeted approach

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: upgrade-insecure-requests

/index.html
  Cache-Control: no-store

/manifest.json
  Cache-Control: public, max-age=86400
  Access-Control-Allow-Origin: *
  Content-Type: application/manifest+json

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/lovable-uploads/*
  Cache-Control: public, max-age=31536000, immutable

/locales/*
  Cache-Control: public, max-age=3600
```

### G. Remove Debug Logging from Production

**Action:** 
1. Gate `AuthDebugPanel` behind `import.meta.env.DEV`
2. Remove or gate console.log statements in `Contact.tsx` behind dev check

### H. Move Exchange Rate API Key to Edge Function

**Action:** Create a new edge function `get-exchange-rate` that proxies the API call with the key stored as a secret. Update `useCurrencyComparator.ts` to call the edge function instead.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/push-notify/index.ts` | Add JWT validation and user_id match check |
| `index.html` | Add `fetchpriority="high"` to preload; defer non-critical font |
| `vite.config.ts` | Add more granular manual chunks |
| `public/_headers` | Remove global `no-store`, add `/locales/*` caching |
| `src/pages/StudentAuthPage.tsx` | Gate `AuthDebugPanel` behind DEV check |
| `src/components/landing/Contact.tsx` | Remove production console.log statements |
| `supabase/functions/get-exchange-rate/index.ts` | NEW -- proxy exchange rate API |
| `src/components/calculator/currency-comparator/useCurrencyComparator.ts` | Call edge function instead of direct API |

**Database migration:**
- Add admin storage policy for `student-documents` bucket

**Backend config:**
- Enable leaked password protection via auth settings

---

## What Will NOT Change

- Navigation order, logo, student portal button
- Brand colors and design language
- Existing RLS policies (they are correct)
- login_attempts / contact_submissions INSERT approach (service role is correct)
- SPA redirect pattern (standard and necessary)

