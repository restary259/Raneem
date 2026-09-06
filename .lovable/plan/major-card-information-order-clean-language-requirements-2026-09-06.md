# Major card: information order + clean language requirements

## Rating of the current order (as a team member / student opening the card)

Current order: Duration badge → Description → Suitable for → Required background → Admission tiers → Bagrut units & grade table → Language requirements → Career opportunities → Study requirements → Arab 48 notes → Sources.

Score: **6/10**. Everything a person needs is there, but the answers to the three questions people actually open the card for ("Can I get in with my Bagrut?", "Which German level?", "How do I apply and how long?") sit in the middle, after ~3 screens of prose. The long marketing description comes first, the Bagrut/language facts come later, and "Study requirements" repeats what the tiers already say.

## New order (answers first, story second)

1. **At-a-glance strip** (new, 4-6 compact fact chips): Duration · Teaching language + required level · Admission mode (open / local NC / Hochschulstart) · Application channel (uni-assist / direct / Hochschulstart) · Degree (B.Sc. / Staatsexamen / Ausbildung) · "Last verified".
2. **Can I get in?** — Bagrut units (Math 3 / English 4 / +1 subject 4) and the grade-conversion table, then the three requirement tiers (official → university-specific → Darb guidance).
3. **Language** — the new structured block (see below).
4. **How to apply** — application channel, quota/route for non-EU applicants, aptitude tests (TMS/PhaST), Studienkolleg course if needed (pulled from tiers/notes; no new facts).
5. **What you study / who it suits** — description + suitable for (shortened to one paragraph each).
6. **Careers & salary**.
7. **Notes for Arab 48 students**.
8. **Sources** (unchanged).

"Study requirements" (`requirements`) is dropped from the health cards because the tiers now cover it; other categories keep it until they are audited.

## Clean language requirements

Replace the paragraph with a structured `languageProfile` on each health major, rendered as a small fact table:

```text
Teaching language      German (all public universities)
Required German level  C1 — DSH-2 · TestDaF 4x4 · telc C1 Hochschule · Goethe C2 · DSD II
Exceptions             JLU Giessen: DSH-1 / TestDaF 14 / B2 at application, higher proof later
English-taught option  None at bachelor level (master only, e.g. RWTH M.Sc.)
Source                 RO-DT (KMK/HRK) · university pages checked Sep 2026
```

Rows: `teachingLanguage`, `requiredLevel`, `acceptedCertificates[]`, `exceptions[]` (university-specific, optional), `englishOption`, all AR + EN. Only verified content moves into it; nothing new is claimed. Where a level is "usually" rather than legally fixed (Nursing/Physiotherapy B2), the row says "typical — set by each school" explicitly.

## Technical details

- `src/data/majorsData.ts`: add `LanguageProfile` interface + optional `SubMajor.languageProfile` and an optional `SubMajor.glance` object (`degree`, `admissionMode`, `applicationChannel`, AR/EN). Populate for the 9 health majors from the already-verified data; keep `languageRequirements` text as fallback for other categories.
- `src/utils/majorLocale.ts`: `getLocalizedLanguageProfile`, `getLocalizedGlance`.
- `src/components/educational/MajorModal.tsx`: reorder sections as above; add `GlanceStrip` and `LanguageTable` sub-components; hide the plain language paragraph when a profile exists; hide "Study requirements" when tiers exist. RTL-safe (logical props), Western digits.
- `public/locales/{en,ar}/common.json`: keys `educational.glance*`, `educational.lang*`, `educational.sectionCanIGetIn`, `educational.sectionHowToApply`.
- `src/data/majorsData.test.ts`: health majors must have `languageProfile` + `glance`; AR/EN array lengths match.
- Regenerate `supabase/functions/ai-chat/knowledge.generated.ts` so the assistant answers with the same structured language facts.
- Verify: build, vitest, Playwright screenshots of Medicine (AR) and Nursing (EN) cards.
