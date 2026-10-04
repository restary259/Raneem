# Fix the "Publish to Google" bar on the Google profile page

## Why the button is greyed out
The button is locked whenever the profile has a problem it won't send to Google: empty business name, description too long, invalid website or phone number, or a day where closing time is not after opening time (e.g. 09:00–09:00 or an empty time). The page checks this silently and never tells you which problem it found, so the button just looks broken.

## Changes
1. **Show the bar only when there are unsaved changes.** If nothing changed, the bar is hidden completely (no "In sync" bar sitting at the bottom).
2. **Explain the blocker.** When there is a problem, show a short red line above the buttons listing what to fix (e.g. "Closing time must be after opening time"), and highlight the related field/day.
3. **Keep the button clickable.** Instead of greying it out, clicking it with a problem shows the message and scrolls to the field. With no problems it opens the confirm dialog and publishes as today.
4. **Make sure publishing works end to end.** After publishing, the page reloads from Google, the bar disappears, and a success message shows; failures show Google's real reason.

## Technical details
- File: `src/pages/team/TeamGoogleProfilePage.tsx` only.
- Render the sticky bar under `canEdit && changedFields.length > 0`.
- Render `errors` list in the bar; Publish disabled only on `busy`; `onClick` toasts `errors[0]` and returns when errors exist (existing guard in `handleSave`).
- Verify with Playwright on `/team/google/profile`: edit a field → bar appears; set invalid hours → message shown; fix → publish runs and bar hides. Check console for the update server function result.
- No database or translation-key changes beyond reusing existing `googleProfile.err*` strings.
