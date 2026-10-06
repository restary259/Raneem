# Why the new Visa Information form isn't showing

## Cause (verified)
The new 9-step form only appears when the student has a study file (case), because answers are saved on that case and the team reviews them there. After the test reset there are **0 cases** in the database, so Tsukuyomi has none and the page shows only the old "Legal / Visa Information" box.

## Fix
1. **No case yet:** show the "Visa Information" card with a clear message instead of nothing: "Your visa form opens once your DARB team has opened your study file." (en/ar/he). The student is never left wondering.
2. **Case exists:** show the 9-step form, and hide the old "Legal / Visa Information" box so questions aren't asked twice (eye colour, passport expiry, criminal record etc. now live in the form). The old box still shows only when there's no case, so nothing already entered is lost from view.
3. **To test now:** create a case for Tsukuyomi from the team side (or through `/apply`), then reload the Visa page; the form appears.

## Technical notes
- `StudentVisaPage.tsx`: render `<VisaInfoWizard>` when `caseId`, otherwise a small empty-state card; wrap the legacy legal card in `!caseId`.
- New keys `visaInfo.noCaseTitle` / `visaInfo.noCaseBody` in `public/locales/{en,ar,he}/dashboard.json`.
- No database changes. Team/admin panels unchanged.
