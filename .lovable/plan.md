# Homepage logo marquee desktop repair

## Audit findings

### Confirmed current behavior
- The homepage renders two independent, duplicated auto-scrolling tracks in `HomepageExperience.tsx`: 9 TU9 universities and 6 language schools, each repeated twice for looping.
- Desktop measurement at 1280px:
  - TU9 viewport: 1216px; track: 2782px; tile widths vary around 153.6–155.8px; animation: 34s.
  - Schools viewport: 1216px; track: 2134px; tile widths vary from 153.6px to 199.8px; animation: 40s.
- Mobile measurement at 390px:
  - TU9 viewport: 358px; track: 2746px; animation: 26s.
  - Schools viewport: 358px; track: 2126px; animation: 31s.
- All 15 marquee logos loaded in the tested desktop/mobile run. The observed marquee problem is layout normalization, not a current failed request.
- Hover pauses only the hovered marquee, as intended. The tracks use a duplicated-list `translateX(-50%)` loop, which is structurally correct.

### Exact desktop visual/root cause
1. **The tile width is not truly fixed.** `src/styles.css` gives both tile types `flex: 0 0 clamp(...)`, but leaves the flex item’s default `min-width: auto`. Wide school logos therefore impose their intrinsic minimum content width. At desktop, F+U and Alpha Aktiv expand to about 199px while Victoria is about 154px. This creates visibly uneven cells and changes the track’s real width.
2. **Logos are constrained only by independent maximum height and width.** In `HomepageExperience.tsx`, TU9 logos use `max-h-11 max-w-[126px]`; schools use `max-h-12 max-w-[170px]`. Their very different intrinsic aspect ratios then produce large perceived-size differences: TU9 logos measured from 84.5×44px to 126×28.3px; school logos from 170×28px to 169×48px.
3. **The desktop viewport exposes the inconsistency more clearly.** Desktop shows roughly eight TU9 cells and six-to-seven school cells simultaneously, so uneven widths, mixed optical heights, and edge clipping appear like a broken row. Mobile shows only two or three cells, and the existing `flex-basis: 150px` rule makes the motion read as an intentional carousel.
4. **The school edge mask uses the wrong surface color.** Both marquee fades use `--background`, while the school marquee uses `bg-editorial-paper`. This produces white edge washes over the off-white school strip instead of a seamless fade.
5. **The loop distance itself is not the cause.** The two data halves are identical and the `-50%` transform lands on the duplicate set. No discontinuity was visible near the loop boundary in the desktop capture.
6. **Loading is a resilience concern, not the reproduced desktop fault.** Several assets are remote Wikimedia/school URLs; the fallback works after an error, but remote latency can still reveal an empty logo area temporarily. Bundled Perfekt Deutsch, KAPITO, and embedded Alpha Aktiv loaded consistently.
7. **Duplicate-school accessibility differs from TU9.** TU9’s repeated half is removed from keyboard/accessibility navigation; the school repeat remains focusable and announced. This does not cause the visual issue but should be corrected while preserving clickability of the primary set.

## Implementation plan

### 1. Normalize the marquee structure
- Extract one small reusable logo-marquee component used by both rows, while keeping their current labels, destinations, durations, and bright surfaces.
- Render two identical track groups with explicit group wrappers rather than relying on unconstrained child content.
- Mark the duplicate group `aria-hidden` and remove its links from tab order; keep every primary logo fully clickable and keyboard accessible.

### 2. Lock desktop geometry without changing mobile appearance
- Add `min-width: 0`, an explicit fixed flex basis/width, and stable row height to each desktop tile so intrinsic image dimensions cannot widen a cell.
- Preserve the current mobile 150px tile basis and current mobile row heights, spacing, and speeds.
- Give every logo a fixed inner logo stage. Fit images with `width: 100%`, `height: 100%`, and `object-fit: contain`, then apply small per-logo optical-size modifiers only where aspect ratio requires it.
- Keep the current bright white/off-white backgrounds and restrained borders.

### 3. Make the loop mathematically stable
- Animate one complete group width rather than the full unconstrained track width.
- Keep the duplicated groups equal in width and spacing so the reset is seamless at desktop, mobile, and intermediate widths.
- Preserve hardware-accelerated transforms and the existing 34s/40s desktop and 26s/31s mobile pacing unless visual verification shows a speed regression.

### 4. Correct surfaces and loading states
- Use a surface-aware fade color: white for TU9 and editorial off-white for schools.
- Reserve every image stage before loading to prevent logo shifts.
- Keep the existing text fallback, but center it in the same fixed stage so a failed remote logo cannot alter tile dimensions.
- Do not replace or hotlink new assets during this repair; retain current official links and bundled assets.

### 5. Preserve interaction and motion preferences
- Keep pause-on-hover and pause-on-keyboard-focus for each row independently.
- Keep primary links opening the official university/school sites.
- Under reduced motion, stop animation, remove edge masks, expose horizontal scrolling, and ensure only the primary set is navigable so duplicate logos are not repeated.

## Verification
- Compare screenshots at 1280×1800 and 1440×1200, plus 390×844 mobile, in Arabic RTL and English LTR.
- Measure every tile and logo stage in the browser: equal desktop tile widths, stable heights, no image exceeding its stage, and two equal group widths.
- Observe a full animation cycle and capture the reset boundary to confirm no jump, blank gap, overlap, or cut-off logo.
- Verify hover pause, keyboard focus pause, every primary link, duplicate accessibility removal, and reduced-motion horizontal scrolling.
- Throttle image loading and force one remote-logo failure to confirm stable dimensions and a readable fallback.
- Confirm no horizontal page overflow, failed marquee requests in the normal run, console errors caused by the marquees, or build errors.

## Scope boundary
- Change only the homepage marquee rendering/styles and, if needed, its small reusable presentation component.
- Do not change homepage copy, logo destinations, other homepage sections, public navigation, dashboards, data, or backend behavior.
