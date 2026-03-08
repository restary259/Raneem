
## Two Issues to Fix in the CV Builder Print Flow

### Issue 1 — Weird URL link at the bottom of the PDF
This is Chrome's **built-in "Headers and footers"** feature (visible in the screenshot — the checkbox is checked). It prints the page URL and timestamp automatically. This cannot be removed via DOM CSS selectors because Chrome injects it at the OS print layer, not as a DOM element.

**Fix:** Add `@page { margin: 0mm; }` to override the default margins — Chrome's headers/footers only appear when page margins are non-zero. Set the margin to `0` so Chrome has no space to inject its header/footer, then add internal padding on `#cv-preview` instead.

The existing `cv-print.css` has `@page { size: A4; margin: 10mm 15mm; }` — change this to `margin: 0` and compensate by adding `padding: 10mm 15mm` directly on `#cv-preview`.

---

### Issue 2 — CV content renders blank / only shows name
From the screenshot, page 2 only shows "asdasa sdasdasd" (the name header) and the rest is blank. This is caused by:

1. **`overflow-auto` on the `#cv-preview` container** — `CVPreview.tsx` line 15 has `overflow-auto` on the wrapper div. During print, `overflow: auto` clips content instead of expanding it. The existing `cv-print.css` does set `overflow: visible` on `#cv-preview`, but that applies to the *outer* div, not the template's internal scrollable content.

2. **`position: absolute; left: 0; top: 0`** in `cv-print.css` line 13 — positioning the CV absolutely works for isolating it, but combined with the wrapper's scroll clipping it cuts off content below the viewport height on the first page.

**Fix in `cv-print.css`:**
- Remove `position: absolute` — use `position: fixed` instead (better for print isolation across all browsers), OR better: use `display: block` with no position override and rely purely on `visibility` isolation.
- The cleanest fix: keep `visibility` isolation but switch from `position: absolute` to removing the position entirely and letting the browser flow it normally within the print layout.
- Also add `overflow: visible !important` to **all descendants** of `#cv-preview` to ensure inner divs with scroll don't clip.

**Fix in `CVPreview.tsx`:**
- Remove `overflow-auto` from the wrapper `div` — it causes clipping both on screen (scrollable preview) and in print. Replace with `overflow-hidden` for screen and add a `print:overflow-visible` class.

---

### Files to change: 2 files

**`src/styles/cv-print.css`** — the `@media print` block:

```css
@media print {
  body * { visibility: hidden; }

  #cv-preview, #cv-preview * { visibility: visible; }

  /* Remove position:absolute — let it flow from top naturally */
  #cv-preview {
    position: fixed;          /* isolates from rest of page */
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border: none;
    overflow: visible !important;
    max-height: none !important;
  }

  /* Force all inner scroll containers open */
  #cv-preview * {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Remove Chrome header/footer by zeroing page margins */
  @page {
    size: A4;
    margin: 0;              /* ← KEY: eliminates Chrome's URL header/footer */
  }
}
```

**`src/components/lebenslauf/CVPreview.tsx`** — remove `overflow-auto` from wrapper:

```tsx
<div
  id="cv-preview"
  dir={dir}
  className="cv-preview-container bg-white shadow-lg border rounded-lg overflow-hidden print:overflow-visible"
>
```

Change `overflow-auto` → `overflow-hidden` (clips the preview on screen cleanly) + `print:overflow-visible` (opens it up during print).

---

### Summary

| Fix | File | Change |
|-----|------|--------|
| Remove Chrome URL header/footer | `cv-print.css` | `@page { margin: 0 }` |
| Show full CV content | `cv-print.css` | `#cv-preview * { overflow: visible !important; max-height: none !important }` + `position: fixed` |
| Prevent preview scroll from clipping print | `CVPreview.tsx` | `overflow-hidden print:overflow-visible` |
