
## Full E2E Audit Results — Appointments Page

### Test session completed as `team@gmail.com`

#### ✅ PASSING — All core features work

| Feature | Result |
|---------|--------|
| Week view loads | ✅ Empty calendar, hour labels AM8–PM8 |
| ASCII numerals on calendar dates | ✅ 8, 9, 10, 11… no Arabic-Indic digits |
| New Appointment modal opens | ✅ All fields present |
| Manual name entry | ✅ Switches from dropdown to text input |
| Duration selector (5 buttons) | ✅ 30m, 45m, 1h, 1.5h, 2h all clickable |
| Appointment created & appears on grid | ✅ "Ahmad Test · 30m · AM 10:00" on correct slot |
| Month view | ✅ March 2026, today highlighted, appointment visible |
| Day view | ✅ Full-width block, "Today · Sunday, March 8" pill |
| Detail modal (click block) | ✅ Name, status badge "Upcoming", date, time, notes |
| Edit modal | ✅ Pre-filled with existing data, "Save Changes" button |
| Edit saves correctly | ✅ Updated notes reflected in detail modal |
| Delete confirmation dialog | ✅ Shows correct message, Cancel works |
| View navigation (prev/next, Today) | ✅ Arrows and Today button work |

#### ❌ BUGS FOUND — 3 issues to fix

---

### Bug 1 — Delete/Detail dialogs render RTL when in English mode (HIGH)

**Root cause**: `i18n.ts` line 52 sets `document.documentElement.dir = "rtl"` when language is Arabic. The app's `lng` defaults to `"ar"` (line 16). When the user keeps the UI in Arabic (`lng = "ar"`), ALL dialogs on `TeamAppointmentsPage` inherit `dir="rtl"` from the `<html>` element.

The dialogs have no `dir` override, so English-string dialogs are rendered mirrored:
- "Delete Appointment?" appears as "?Delete Appointment"
- Confirmation text reads right-to-left
- Time in detail modal: "10:00 AM · 30 min" renders as "AM · 30 min 10:00"

**Fix**: Add `dir="ltr"` to all Dialog `DialogContent` elements in `TeamAppointmentsPage.tsx` that contain English-only hardcoded strings (the New/Edit modal, Detail modal, Delete confirm, Reschedule confirm). This mirrors the fix already applied in `AppointmentOutcomeModal.tsx` which correctly has `dir={isRtl ? 'rtl' : 'ltr'}` on its `DialogContent`.

---

### Bug 2 — "Record Outcome" button hidden for today's appointments (MEDIUM)

**Root cause**: Line 987 of `TeamAppointmentsPage.tsx`:
```typescript
{!selectedAppt.outcome && new Date(selectedAppt.scheduled_at) < new Date() && (
  <Button ...>Record Outcome</Button>
)}
```
The test appointment was set at 10:00 AM UTC today. The browser time may be in a different timezone (UTC+2/UTC+3 for Israel). `scheduled_at` is stored as UTC in the database. When the browser evaluates `new Date(selectedAppt.scheduled_at)`, it converts to local time correctly — BUT if the test appointment was scheduled at "10:00" in the modal (using `dt.setHours(10, 0, 0, 0)` which is LOCAL time), it gets stored as UTC-3 which is 07:00 UTC. The check works but only shows the button strictly after the scheduled time in local browser timezone, so the button is actually correct (it only shows after the appointment time has passed).

This is not a bug — the behavior is correct and the "Record Outcome" button is intentionally gated to past appointments only.

---

### Bug 3 — Delete dialog text RTL flip causes "?Delete Appointment" (same root as Bug 1)

This is a manifestation of Bug 1. The fix is the same.

---

### What to Fix

**File: `src/pages/team/TeamAppointmentsPage.tsx`**

The 4 `DialogContent` elements need `dir={isAr ? "rtl" : "ltr"}` added (the component already has `const isAr = i18n.language === "ar"`):

1. **New/Edit modal** (line ~750): `<DialogContent className="max-w-md">` → `<DialogContent className="max-w-md" dir={isAr ? 'rtl' : 'ltr'}>`
2. **Detail modal** (line ~920): `<DialogContent className="max-w-sm">` → `<DialogContent className="max-w-sm" dir={isAr ? 'rtl' : 'ltr'}>`
3. **Reschedule confirm** (line ~1012): `<DialogContent className="max-w-sm">` → `<DialogContent className="max-w-sm" dir="ltr">` (always LTR — no Arabic content)
4. **Delete confirm** (line ~1048): `<DialogContent className="max-w-sm">` → `<DialogContent className="max-w-sm" dir="ltr">` (always LTR — no Arabic content)

That's it — 4 attribute additions in one file. No DB changes, no new translations needed.

---

### Files to Change

| File | Change |
|------|--------|
| `src/pages/team/TeamAppointmentsPage.tsx` | Add `dir` attribute to 4 DialogContent elements |
