

## PWA Rendering Fix -- Complete Plan

### Issues Found

1. **Manifest `orientation: "portrait-primary"`** -- Forces portrait-only rendering, which can cause scaling issues on desktop and tablets. Should be `"any"` to let the OS handle orientation naturally.

2. **Service worker force-unregister conflict** -- `index.html` has an emergency script (lines 164-171) that unregisters ALL service workers on every page load, but `pwaUtils.ts` immediately re-registers one. This creates an infinite unregister/register loop and can cause stale cached CSS/JS to flicker.

3. **Missing `#root` width/height rules** -- The `#root` element has no explicit `width: 100%` or flex column layout, so PWA standalone mode can sometimes render with incorrect dimensions.

4. **PWA standalone CSS is minimal** -- `pwa.css` only handles tap-highlight and footer hiding. Missing rules for zoom reset, transform reset, and proper `#root` layout in standalone mode.

5. **No zoom/transform reset for PWA standalone** -- When the app runs as an installed PWA, some mobile browsers apply slight scaling. There are no explicit overrides.

---

### Changes

#### 1. Update `public/manifest.json`
- Change `"orientation": "portrait-primary"` to `"orientation": "any"`
- This prevents forced portrait scaling on desktop/tablet PWA installs

#### 2. Fix the service worker conflict in `index.html`
- Remove the emergency force-unregister script (lines 164-171) since the service worker is healthy (v3.0.0) and this script conflicts with the normal registration in `pwaUtils.ts`
- Keep the PWA loading/display-mode script unchanged

#### 3. Update `src/styles/pwa.css`
Add comprehensive PWA standalone rendering rules:
- `#root` gets `width: 100%`, `min-height: 100vh/100dvh`, `display: flex`, `flex-direction: column`
- Explicit `zoom: 1 !important` and `transform: none !important` on `html` and `body` in standalone mode
- Proper safe-area inset handling for notched devices
- Keep existing footer-hide logic for mobile

#### 4. Update `src/styles/base.css`
- Add `#root` base styles: `width: 100%; min-height: 100vh; display: flex; flex-direction: column`
- This ensures consistent rendering regardless of PWA or browser mode

---

### Files to Modify

| File | Change |
|------|--------|
| `public/manifest.json` | `orientation` from `"portrait-primary"` to `"any"` |
| `index.html` | Remove emergency SW unregister script (lines 164-171) |
| `src/styles/pwa.css` | Add comprehensive standalone mode rules |
| `src/styles/base.css` | Add `#root` base layout styles |

---

### Technical Details

**pwa.css additions:**
```css
@media all and (display-mode: standalone) {
  html, body {
    zoom: 1 !important;
    transform: none !important;
    width: 100% !important;
  }
  
  #root {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
}
```

**base.css addition:**
```css
#root {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
```

**manifest.json change:**
```json
"orientation": "any"
```

### What Will NOT Change
- Navigation order, logo, student portal button
- Service worker caching logic (v3.0.0 is correct)
- Brand colors and design language
- Any existing page functionality

