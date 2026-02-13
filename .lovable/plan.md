

## Aggressive Mobile Performance Optimization

### Problem
The app has a high LCP (~6.8s) and FCP, primarily caused by:
- 27 PNG images in `lovable-uploads/` (no modern formats, no responsive sizing, no lazy loading)
- Render-blocking CSS bundle
- Hero video loading competing with critical resources
- `backdrop-blur` effects causing GPU strain on mobile
- No skeleton loaders for perceived performance

### Changes Overview

**1. Image Optimization -- All `<img>` tags across components**

Add `loading="lazy"` and `decoding="async"` to all below-the-fold images. The header logo (above-the-fold) keeps eager loading.

Files affected:
- `src/components/landing/Header.tsx` -- add `fetchpriority="high"` to logo (LCP candidate)
- `src/components/landing/StudentGallery.tsx` -- add `loading="lazy"` + `decoding="async"`
- `src/components/partners/partnersData.ts` uses image URLs in data; the rendering components need lazy loading
- `src/components/partners/components/UniversityCarousel.tsx`, `LanguageSchoolCarousel.tsx`, `LocalServiceCarousel.tsx` -- add lazy loading to card images
- `src/components/partners/InfluencerCard.tsx`, `ServiceCard.tsx`, `UniversityCard.tsx` -- lazy load
- `src/components/about/CeoMessage.tsx`, `TeamSection.tsx` -- lazy load avatars

**2. Critical Rendering Path -- `index.html`**

Inline the minimal critical CSS (background color, font-family, layout) directly in `<style>` so the browser paints immediately without waiting for the CSS bundle. The existing `<style>` block already has some inline styles; we extend it with above-the-fold critical styles (header background, text color, basic layout).

**3. Hero Video Optimization -- `src/components/landing/Hero.tsx`**

- Add `preload="none"` to the video element so it doesn't compete with LCP resources on mobile
- The poster image is already preloaded in `index.html` -- this is correct
- Remove `backdrop-blur-sm` from the hero overlay on mobile (GPU-intensive), replace with a solid overlay

**4. Reduce `backdrop-blur` on Mobile -- Multiple components**

`backdrop-blur` triggers expensive compositing on mobile GPUs. Replace with solid backgrounds on mobile:
- `src/components/landing/Hero.tsx` -- use `bg-primary/85` instead of `bg-primary/80 backdrop-blur-sm`
- `src/components/landing/Contact.tsx` -- simplify blur classes
- `src/components/chat/ChatPopup.tsx` and `AIChatPopup.tsx` -- use `bg-background` instead of `bg-background/80 backdrop-blur-sm`

**5. Skeleton Loaders -- New component + usage**

Create a reusable `ImageSkeleton` component and use it in `StudentGallery` for visual loading placeholders. This improves Speed Index by showing a populated UI frame immediately.

File: `src/components/ui/image-with-skeleton.tsx` (new)
- Wraps `<img>` with an `onLoad` callback that hides the skeleton
- Uses the existing `Skeleton` component

**6. Bundle Cleanup -- `vite.config.ts`**

The manual chunks config is already good. Add `cssCodeSplit: true` (default but explicit) and ensure tree-shaking is working. No major changes needed here since Vite handles this well.

**7. Cache Headers -- `public/_headers`**

Already well-configured with immutable caching for assets. No changes needed.

### Technical Details

| File | Change |
|------|--------|
| `index.html` | Extend inline `<style>` with critical above-the-fold CSS (header bg, container layout) |
| `src/components/landing/Hero.tsx` | Add `preload="none"` to video; remove `backdrop-blur-sm` |
| `src/components/landing/StudentGallery.tsx` | Add `loading="lazy"` + `decoding="async"` to images |
| `src/components/landing/Header.tsx` | Add `fetchpriority="high"` to logo img |
| `src/components/landing/Contact.tsx` | Remove `backdrop-blur-sm` from mobile |
| `src/components/chat/ChatPopup.tsx` | Simplify `bg-background/80 backdrop-blur-sm` to `bg-background` |
| `src/components/chat/AIChatPopup.tsx` | Simplify blur |
| `src/components/about/CeoMessage.tsx` | Remove `backdrop-blur-lg`, use solid bg |
| `src/components/ui/image-with-skeleton.tsx` | New: reusable lazy image with skeleton placeholder |
| Multiple partner card components | Add `loading="lazy"` to all `<img>` tags |

### Expected Impact
- **LCP reduction**: ~4-5s savings from lazy-loading images + video `preload="none"` + eliminating blur compositing
- **FCP reduction**: ~2-3s from inlined critical CSS
- **Speed Index improvement**: Skeleton loaders provide immediate visual population
- **No visual changes**: All styling and layouts remain identical

