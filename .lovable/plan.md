
## Mobile Overflow & Localization Audit — Team Dashboard

### Screenshots Captured

**Page 1: /team (Today)** — "Sunday, March 8" date header is hardcoded English regardless of language  
**Page 2: /team/cases** — `formatDistanceToNow()` output renders reversed ("minutes ago 34" instead of "34 minutes ago") — layout bug from RTL context  
**Page 3: /team/students** — Looks good ✅  
**Page 4: /team/appointments** — "TUE", "MON", "SUN" headers are English; "Mar 8 – Mar 14, 2026" date range is English; "AM 8", "PM 12" time labels are English  
**Page 5: /team/analytics** — KPI labels show raw key text `lawyer.analytics.closedThisMonth` instead of resolved text — duplicate `kpi` block in JSON corrupts object

---

### Root Cause Analysis

**Bug 1 — Duplicate `lawyer.kpi` block in both locale files (CRITICAL)**
`public/locales/en/dashboard.json` has `lawyer.kpi` at line 865 AND line 932. The second block overwrites the first. This causes `lawyer.analytics.closedThisMonth` to silently fail to resolve because JavaScript's `JSON.parse` silently takes the last duplicate key, wiping out any block that came between them. Fix: remove the duplicate `kpi` block (lines 932–941 in EN, same in AR).

**Bug 2 — Date header hardcoded to English in TeamTodayPage**
`TeamTodayPage.tsx` line 86: `new Date().toLocaleDateString("en-US", ...)` — hardcoded `"en-US"` locale. Must use `isAr ? "ar-SA" : "en-US"` and add `dir={isAr ? 'rtl' : 'ltr'}` on the page container.

**Bug 3 — `formatDistanceToNow` reversed in RTL in TeamCasesPage**
`TeamCasesPage.tsx` line 233: `formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })` — date-fns outputs English and in RTL context the "ago" suffix appears at the wrong end visually. Fix: wrap the timestamp span in `dir="ltr"` inline direction so it always reads left-to-right, even inside RTL layout. Same fix needed in `TeamTodayPage.tsx` line 117 where `format(new Date(a.scheduled_at), "MMM d, h:mm a")` produces English month names.

**Bug 4 — Appointments calendar: English time labels, day names, date range**
`TeamAppointmentsPage.tsx`:
- Line 637: `format(new Date().setHours(hour, 0, 0, 0), "h a")` → produces "8 AM". Fix: use `isAr ? `${hour < 12 ? 'ص' : 'م'} ${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}`` : `format(..., "h a")``
- Line 613: `format(day, "EEE")` → "TUE", "MON". Fix: use `day.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' })` 
- Header date range (week/month/day): use locale-aware formatting

---

### Files to Change

| File | Bug Fixed |
|------|-----------|
| `public/locales/en/dashboard.json` | Remove duplicate `lawyer.kpi` block (lines ~932–941) |
| `public/locales/ar/dashboard.json` | Remove duplicate `lawyer.kpi` block (same location in AR file) |
| `src/pages/team/TeamTodayPage.tsx` | Fix date header locale (`en-US` → dynamic), fix `format()` month names, add `dir` to container |
| `src/pages/team/TeamCasesPage.tsx` | Wrap `formatDistanceToNow` span in `dir="ltr"` so timestamp reads correctly in RTL |
| `src/pages/team/TeamAppointmentsPage.tsx` | Fix time labels (AM/PM → ص/م), week day names, and date range header locale |

---

### Precise Changes

**1. `public/locales/en/dashboard.json`** — delete the second `"kpi"` block inside `"lawyer"` (the one around line 932–941, which is identical to the one at line 865). This restores correct JSON key resolution.

**2. `public/locales/ar/dashboard.json`** — same: delete the duplicate `"kpi"` block inside `"lawyer"` that was added by the previous analytics task (~line 960–969 in AR).

**3. `src/pages/team/TeamTodayPage.tsx`**
- Line 86–90: change `"en-US"` → `isAr ? "ar-SA" : "en-US"` 
- Line 93: add `dir={isAr ? 'rtl' : 'ltr'}` to the outer `<div>`
- Line 117: change `format(new Date(a.scheduled_at), "MMM d, h:mm a")` → `new Date(a.scheduled_at).toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })`

**4. `src/pages/team/TeamCasesPage.tsx`**
- Line 230–234: add `dir="ltr"` + `className="inline-block"` on the timestamp `<span>` so "34 minutes ago" doesn't reverse in RTL

**5. `src/pages/team/TeamAppointmentsPage.tsx`**
- Time labels in day view (around line 546): `format(new Date().setHours(hour, 0, 0, 0), "h a")` → use locale-aware `toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: 'numeric', hour12: true })`
- Week view time labels (line 637): same fix
- Week day names (line 613): `format(day, "EEE")` → `day.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'short' })`
- Month view day names (line 677 in original, the `["Sun","Mon",...]` array): already uses `t()` keys from previous task — verify it uses the Arabic `dayAbbrev*` keys
- Date range header text: wrap in `dir={isAr ? 'rtl' : 'ltr'}`
