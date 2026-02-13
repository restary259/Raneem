

## CV Builder Fix, Image Export, Bottom Nav Update, and Platform-Wide Verification

This plan covers the CV builder print/export improvements, adding screenshot/image download, replacing the Housing tab with Apply in the mobile bottom nav, and a systematic English/LTR verification pass across all dashboards.

---

### 1. CV Builder -- Remove Lovable Branding from Print/Export

**Problem**: When printing, the Lovable badge (injected globally) may appear in the PDF output.

**Fix**:
- Update `src/styles/cv-print.css` to explicitly hide the Lovable badge element during print:
  - Add rules targeting `[data-lovable-badge]`, `#lovable-badge`, and any iframe/div with Lovable branding classes using `display: none !important` inside the `@media print` block.
- Also hide `BottomNav`, `ChatWidget`, `PWAInstaller`, `CookieBanner` in print via selectors.

### 2. CV Builder -- Optimize PDF/Print Margins

**Fix in `src/styles/cv-print.css`**:
- Change `@page` margin from `15mm` to `10mm 15mm` (tighter top/bottom, comfortable sides) for better A4 fit.
- Add `overflow: visible` to `#cv-preview` so content is never clipped.
- Ensure the preview container has no max-height in print mode.
- Add `page-break-inside: avoid` to individual CV entry blocks (education, experience items).

### 3. CV Builder -- Add Screenshot and Image Download Options

**Changes to `src/components/lebenslauf/useLebenslauf.ts`**:
- Add `handleDownloadImage` function using the Canvas API:
  - Use `html2canvas` approach via a simple DOM-to-canvas utility (we'll implement a lightweight version using the built-in browser APIs or add a small helper).
  - Since we can't install new npm packages easily, we'll use the browser's native `window.print()` for PDF and implement image capture using a canvas-based approach with `document.querySelector('#cv-preview')`.

**Alternative approach (more reliable)**: Use the browser's built-in `Selection` and `Range` API with `document.execCommand('copy')` -- but for image download, we'll implement a canvas rendering approach:

- Create a utility function `captureElementAsImage(elementId: string, format: 'png' | 'jpeg')` in `src/utils/captureUtils.ts`:
  - Clone the target element
  - Use `XMLSerializer` to convert to SVG foreignObject
  - Draw on canvas
  - Export as blob and trigger download

**Changes to `src/components/lebenslauf/LebenslaufBuilder.tsx`**:
- Add two new toolbar buttons: "Download as Image (PNG)" and "Download as JPG"
- Wire them to the new capture utility

**Changes to `useLebenslauf.ts`**:
- Add `handleDownloadPNG` and `handleDownloadJPG` functions
- Return them from the hook

**Translations**: Add keys `downloadPNG` and `downloadJPG` to both `en/resources.json` and `ar/resources.json` under `lebenslaufBuilder.actions`.

### 4. Mobile Bottom Nav -- Replace Housing with Apply

**File: `src/components/common/BottomNav.tsx`**:
- Replace the Housing nav item with Apply:
  - Change `name` from `t('housing.title', 'Housing')` to `t('bottomNav.apply', 'Apply')`
  - Change `href` from `/housing` to `/apply`
  - Change `icon` from `Home` to a relevant icon like `FileText` or `Send` from lucide-react
  - Update `ariaLabel`

**Translations**: Add `bottomNav.apply` and `bottomNav.applyAria` to both `en/common.json` and `ar/common.json`.

### 5. English/LTR Verification and Fixes

This is a systematic pass through the codebase to verify all components render correctly in English/LTR mode. Based on code review, the following areas need attention:

**Contact form (`src/components/landing/Contact.tsx`)**:
- The form container has `text-right` hardcoded -- should be `text-right` only in RTL. Change to use dynamic direction class.

**Dashboard components**:
- Verify all dashboard pages (Admin, Lawyer, Student, Influencer) use `useDirection()` hook and apply `dir` attribute.
- Check that status badges, timers, and card layouts don't break with longer English text.

**Forms and validation**:
- Ensure all form validation messages are translated and positioned correctly in LTR.
- Check that required field markers and error messages align properly.

### 6. Platform-Wide Functional Verification

This phase involves testing (not code changes) across:
- Admin dashboard: leads, cases, team management, export, eligibility override
- Lawyer dashboard: case cards with eligibility display
- Student dashboard: application tracking, document uploads
- Influencer dashboard: lead cards, eligibility badges, 20-day timer
- Referral system: tracking, rewards
- All forms: apply, contact, partnership registration

Any bugs found during testing will be fixed inline.

---

### Technical File Summary

| Action | File | Changes |
|--------|------|---------|
| Edit | `src/styles/cv-print.css` | Hide Lovable badge, optimize margins, prevent content clipping |
| Create | `src/utils/captureUtils.ts` | Canvas-based element-to-image capture utility |
| Edit | `src/components/lebenslauf/useLebenslauf.ts` | Add image download handlers |
| Edit | `src/components/lebenslauf/LebenslaufBuilder.tsx` | Add PNG/JPG download buttons |
| Edit | `src/components/common/BottomNav.tsx` | Replace Housing with Apply |
| Edit | `src/components/landing/Contact.tsx` | Fix hardcoded text-right for LTR support |
| Edit | `public/locales/en/resources.json` | Add downloadPNG/downloadJPG translation keys |
| Edit | `public/locales/ar/resources.json` | Add downloadPNG/downloadJPG translation keys |
| Edit | `public/locales/en/common.json` | Add bottomNav.apply key |
| Edit | `public/locales/ar/common.json` | Add bottomNav.apply key |

### Implementation Order
1. CV print CSS fixes (branding removal + margin optimization)
2. Image capture utility + CV builder download buttons
3. Bottom nav update (Housing to Apply)
4. Contact form LTR fix
5. End-to-end testing across all dashboards in English mode

