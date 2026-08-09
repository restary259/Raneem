# StudentGallery — photo cropping audit (mobile + desktop)

Read-only audit. No code changed. Screenshots captured with Playwright at 390x844 (mobile carousel) and 1280x800 (desktop grid), one element screenshot per card for all 12 cards.

## 1. Source photo measurements (the real driver)

| # | file (prefix) | pixels | aspect | orientation |
|---|---|---|---|---|
| 0 | a8e524a4 | 1200x1600 | 0.75 | portrait |
| 1 | ad84e26f | 900x1600 | 0.56 | tall portrait |
| 2 | 28a02fa1 | 900x1600 | 0.56 | tall portrait |
| 3 | 5ea3a257 | 900x1600 | 0.56 | tall portrait |
| 4 | d34cf9ba | 900x1600 | 0.56 | tall portrait |
| 5 | e42cefe5 | 900x1600 | 0.56 | tall portrait |
| 6 | 9b8b98bb | 747x1600 | 0.47 | very tall portrait |
| 7 | 19a7a716 | 1600x900 | 1.78 | landscape |
| 8 | 4e4eb6e1 | 1200x1600 | 0.75 | portrait |
| 9 | 2df2a47a | 900x1600 | 0.56 | tall portrait |
| 10 | 6cd7ab4d | 1200x1600 | 0.75 | portrait |
| 11 | b88bf7f9 | 900x1600 | 0.56 | tall portrait |

Card boxes today: mobile 320x224 (aspect ~1.43), desktop lg 400-440x320 (aspect ~1.30). So a 0.56 photo shown in a 1.43 box keeps roughly **39% of the image height** and throws away 61%. `object-top` decides that the kept strip is the **top** of the photo.

## 2. Per-photo result (same verdict on mobile and desktop — the boxes have nearly identical aspect)

| # | head/face visible | letterboxing | verdict |
|---|---|---|---|
| 0 | yes, but head sits at the very bottom edge, chin near the caption | none | tight, borderline |
| 1 | two faces, both clipped at the bottom edge; top 60% is ceiling and a lamp | none | bad |
| 2 | yes, well framed | none | good |
| 3 | subject is almost entirely below the crop; only the top of his head shows | none | bad |
| 4 | no person in frame at all (sky + palace roof) | none | bad |
| 5 | no person in frame at all (sky + palace roof) | none | bad |
| 6 | no person in frame (church ceiling vaults only) | none | bad |
| 7 | yes, well framed (this is the one landscape source) | none | good |
| 8 | faces at the very bottom, partially clipped by the edge/caption | none | bad |
| 9 | no person in frame (museum columns only) | none | bad |
| 10 | person is a tiny silhouette at the bottom, mostly cut | none | bad |
| 11 | person cut off at bottom edge, mostly buildings/fog | none | bad |

**No letterboxing anywhere** — `object-cover` guarantees fill. The problem is 100% over-cropping, not empty space. 9 of 12 cards are bad, 2 good, 1 borderline.

## 3. Root cause

Not the card width, not the fixed height on its own, and not a mobile-specific bug — mobile and desktop fail identically.

1. **Aspect mismatch.** The photos are phone-camera verticals (0.47-0.75); the cards are landscape boxes (~1.3-1.43). Only ~35-40% of each photo survives.
2. **`object-top` is the wrong global default for these photos.** In a phone vertical shot, the subject is usually in the middle/lower third and the top third is sky or ceiling. Pinning to the top keeps exactly the part with no person in it. That is why heads are clipped at the bottom edge.
3. **Composition varies a lot.** #7 is landscape and looks right at top; #2 is a mid-frame subject; #3/#10/#11 are wide scenics with a small subject low in the frame. **No single object-position can serve all 12** — this is the core reason a global tweak keeps failing.
4. **Secondary:** five photos (#4, #5, #6, #9, #10) contain essentially no visible student. Even a perfect crop cannot make them read as "our student in Germany".

## 4. Proposed fix

### A. Change the box shape, both breakpoints
Move from a landscape box to a **portrait/near-square box** so far less of a vertical photo is discarded:
- mobile carousel card: `aspect-[3/4]` (e.g. 300x400) instead of `h-56`
- desktop grid card: `aspect-[3/4]` instead of `h-64 / lg:h-80`

At 3:4 (0.75) a 0.56 source keeps ~75% of its height instead of 39%. This one change fixes most cards on its own.

### B. Per-image focal point in `landing.json` (recommended)
Add an optional field per student, defaulting to a sane value when absent:

```json
{ "name": "...", "destination": "ألمانيا", "image": "/lovable-uploads/....webp", "focus": "50% 35%" }
```

Component reads `student.focus` and applies it as an inline `objectPosition`, falling back to `50% 40%` (not `top`). Keys added to both `ar` and `en` landing.json so they stay in sync. This is the right approach here precisely because the 12 compositions differ; a global value would re-break #7 (landscape, subject centred) or #2.

Proposed starting values, to be tuned against fresh screenshots after A lands:
- #7 `50% 30%`, #2 `50% 40%`, #0 `50% 55%`, #1 `50% 75%`, #3 `50% 80%`, #8 `50% 70%`, #11 `50% 75%`, rest `50% 50%`.

### C. Curate the set
Recommend removing or replacing **#4, #5, #6, #9** (no student visible) and reviewing **#10**. That takes the gallery from 12 to 8 strong cards. This needs your decision — I will not drop photos without a yes.

### D. Caption legibility
With a taller card the bottom gradient overlay can be reduced to the bottom ~40% so it stops covering a subject that now sits lower in frame.

### E. Verification
Re-run the same 12-card Playwright capture at 390x844 and 1280x800 and re-check each card before calling it done.

## Technical notes
- Files touched by the fix: `src/components/landing/StudentGallery.tsx`, `public/locales/ar/landing.json`, `public/locales/en/landing.json`.
- `focus` is optional in the `Student` type, so any student entry without it keeps working.
- No backend, no data model, no other route affected.

## Open questions
1. Approve the 3:4 portrait card shape on both mobile and desktop?
2. Approve per-image `focus` values in landing.json, or do you prefer a single global `object-position: 50% 45%` (simpler, but 3-4 cards will still crop poorly)?
3. Remove the four photos with no student in them, or keep them as "life in Germany" atmosphere shots?
