# Heidelberg page: smooth journey line + travel-destination look

## What changes
1. **The gold line moves with you.** The vertical line stays on screen while you scroll. Its gold fill grows smoothly and doesn't jump. A small glowing gold dot rides at the tip of the line, like a marker on a journey. Section dots turn gold as you pass them. The motion is gentle and turns off for visitors who prefer reduced motion.
2. **Presented like a travel destination**, in the style of the city pages on major travel and tourism sites:
   - **Full-screen opening photo** of the castle and old bridge on a bright, sunny day. A big title "تعرّف على هايدلبرغ" sits on it, with 3–4 quick highlights underneath: students, oldest university in Germany, river and hills, safe and walkable. The opening photo also has a "Start exploring" arrow.
   - **"Heidelberg at a glance" strip**: large icon tiles with short highlights (Old Town, Neckar river, Castle, University, Philosophers' Walk).
   - **"Top places to see" carousel**: large photo cards you can swipe on phones, each with a name and one inviting line.
   - **Sections as editorial chapters**: one large hero photo per chapter, a short appealing intro, then the practical facts for students in tidy cards. Chapters alternate left and right on desktop and stack on phones.
   - **Photo mosaic gallery** before the final call to action, then a full-photo call-to-action banner: "ابدأ رحلتك إلى هايدلبرغ".
   - The copy gets a warmer, inviting tone ("discover", "walk", "imagine your morning by the Neckar"), and the student-practical information stays.
3. **Bright, beautiful photos only.** I'll replace dark, grey, night, winter or flat photos with sunny, colourful, high-quality ones: Old Town from the Philosophers' Walk, the castle in sunlight, the Old Bridge in summer, the Neckar meadow, the Marktplatz, the university square and the green campus. Photos still come only from Wikimedia Commons with reusable licences, with no credits on the page and no AI images. I'll review each photo visually before using it.

## Technical details
- `HeidelbergPage.tsx`:
  - Rail: `sticky` container plus a `requestAnimationFrame`-throttled scroll handler. The fill uses `transform: scaleY(progress)` with `origin-top` (GPU, no layout thrash) instead of animating height.
  - A tip dot is positioned with `translateY`. `motion-reduce` disables the transitions.
  - New sections: full-bleed hero (custom, taller than DarbPageHero), a highlights strip, a scroll-snap carousel (`snap-x`, no new library), chapters, a gallery grid and a photo CTA.
  - Semantic tokens only; gold uses `--highlight`; headings use `font-editorial`.
- `src/data/heidelberg.ts`: add `HIGHLIGHTS`, `TOP_PLACES`, `GALLERY` and per-section `cover` photo fields, plus warmer trilingual intro copy. Facts and TODO_VERIFY stay as they are.
- Photos:
  - Search Commons for bright/summer images, download them, check them visually, convert to WebP at about 1600px (hero 1920px) and upload with lovable-assets.
  - Replace weak `.asset.json` pointers and keep author and licence in the data.
- Locales: any new shared labels go in en/ar/he in both locale trees.
- Verify:
  - Typecheck.
  - Playwright at 393px Arabic and 1280px English: the rail stays visible and fills smoothly through a mid-scroll screenshot, the carousel swipes, there is no sideways overflow, and the photos look bright.
