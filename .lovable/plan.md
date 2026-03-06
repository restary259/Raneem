## Full Localization & UI QA Report — DARB Dashboard

### Findings Summary

Based on thorough scan of all 1578 lines of both `en/dashboard.json` and `ar/dashboard.json`, plus component code in `EarningsPanel`, `AdminOverview`, `SparklineCard`, `MobileBottomNav`, and related files.

---

&nbsp;

CRITICAL IMPLEMENTATION RULES — DO NOT BREAK THESE

This task is ONLY for localization fixes and UI rendering fixes.

You must NOT modify:

- database schema
- backend logic
- API behavior
- permissions
- routing
- data models
- application logic

Roles are FINAL and must NOT be changed:

Admin  
Student  
Partner  
Team

Important context:  
All previous "Influencer" functionality was converted to **Partner**.  
All previous "Layers" functionality was converted to **Team**.

DO NOT attempt to rename models or change any stored data.

Your job is ONLY:

1. Fix localization issues
2. Fix mobile UI rendering
3. Ensure numbers always render using ASCII digits
4. Fix overflow issues

---

TASKS TO PERFORM

1. Fix duplicate JSON root keys in localization files.

The following keys exist multiple times and must be merged into a single block:

nav (3x)  
admin (2x)  
common (2x)  
case (2x)  
partner (2x)

Merge them carefully and keep the most descriptive labels.

---

2. Add missing translation keys.

Add these keys to BOTH languages:

influencer.earnings.available  
influencer.earnings.requestCancelled  
influencer.earnings.actions  
influencer.earnings.payoutRequests  
influencer.earnings.minThreshold  
application.serviceFee  
lawyer.kpi.conversionRate  
lawyer.kpi.showRate

Arabic translations must be added.

---

3. Enforce numeric safety across the entire dashboard.

All numeric rendering must use ASCII digits.

Replace every instance of:

.toLocaleString()

with

.toLocaleString('en-US')

This ensures numbers render like:

12,500  
4145414

and NEVER like:

١٢٬٥٠٠

---

4. Fix date formatting.

Replace any:

toLocaleDateString('ar')

with

toLocaleDateString('en-US')

to ensure ASCII digits in dates.

---

5. Fix KPI card overflow issues.

Large values like:

1,234,567 ₪

must not overflow cards.

Add overflow protection to KPI value fields:

truncate  
whitespace-nowrap  
overflow-hidden  
text-ellipsis

Apply responsive font clamping for mobile screens.

---

6. Fix mobile bottom navigation overflow.

The Arabic label:

قائمة المتطلبات

is too long.

Replace with:

المتطلبات

Ensure nav labels never overflow their container.

---

7. Ensure full mobile responsiveness.

All dashboard cards must fit correctly on:

320px  
360px  
375px  
412px

Fix:

text overflow  
card height inconsistencies  
grid misalignment  
button wrapping

without changing logic.

---

FINAL REQUIREMENT

This task is STRICTLY:

translation fixes  
UI rendering fixes  
mobile optimization

You must NOT change application logic, database structure, or feature behavior.

&nbsp;

### A. Duplicate Root-Level Keys (Critical Structural Bug)

The JSON file has **multiple root-level blocks with the same key** — this is a JSON spec violation and causes silent key override (last one wins). Duplicate root keys found:

- `"nav"` appears **3 times** in both EN and AR files (lines 1228, 1448, 1553 in EN)
- `"admin"` appears **2 times** in both EN and AR files (lines 245 and 1277 in EN)
- `"common"` appears **2 times** in both EN and AR files (lines 761 and 1266 in EN)
- `"case"` appears **2 times** in both EN and AR files (lines 1253 and 1540 in EN)
- `"partner"` appears **2 times** in both EN and AR files (lines 1374 and 1482 in EN)

**Effect**: In JavaScript JSON.parse, the last occurrence wins, silently overwriting earlier values. For example, `nav.financials` is `"Financials"` in the first block but `"Finance"` in the last block — the shorter "Finance" wins everywhere including the sidebar.

---

### B. Missing Translation Keys (keys used in code but absent from JSON)

From code analysis:


| Key                                    | Used In                  | EN Value                                  | AR Value  |
| -------------------------------------- | ------------------------ | ----------------------------------------- | --------- |
| `influencer.earnings.available`        | EarningsPanel.tsx:212    | ❌ missing (fallback: "Available")         | ❌ missing |
| `influencer.earnings.requestCancelled` | EarningsPanel.tsx:192    | ❌ missing (fallback: "Request cancelled") | ❌ missing |
| `influencer.earnings.actions`          | EarningsPanel.tsx:300    | ❌ missing (fallback: "Actions")           | ❌ missing |
| `influencer.earnings.payoutRequests`   | EarningsPanel.tsx:277    | ❌ missing (fallback: "Payout Requests")   | ❌ missing |
| `influencer.earnings.minThreshold`     | EarningsPanel.tsx:263    | ❌ missing (has `{amount}` placeholder)    | ❌ missing |
| `application.serviceFee`               | MyApplicationTab.tsx:184 | ❌ missing                                 | ❌ missing |
| `lawyer.kpi.conversionRate`            | TeamAnalyticsTab.tsx     | ❌ missing                                 | ❌ missing |
| `lawyer.kpi.showRate`                  | TeamAnalyticsTab.tsx     | ❌ missing                                 | ❌ missing |


---

### C. Placeholder / ICU Token Issues

1. `influencer.earnings.minThreshold` — Called with `{ amount: minThreshold }` but key doesn't exist yet. When added, must use `{{amount}}` syntax (i18next double-brace).
2. `admin.security.failedAttempts` → `"{{count}} failed attempts in the last hour"` / AR: `"{{count}} محاولة فاشلة في الساعة الأخيرة"` — This is a pluralization case. EN: 1 attempt vs. N attempts. The string doesn't use ICU plural rules; should be `"{{count}} failed attempt(s) in the last hour"` or proper plural form.
3. `admin.notifications.sentDesc` → `"Notification sent to {{count}} subscriber(s)"` — Same plural issue; no `_plural` key or ICU plural rule defined.
4. `kpi.paidStudents` → `"{{count}} paid students"` / AR: `"{{count}} طالب مدفوع"` — Arabic needs plural forms (singular/dual/plural). Currently only one form.
5. `cases.daysRemaining` / `influencerPayouts.daysRemaining` / `cases.studentFiles` — all use `{{count}}` without plural variants.
6. `partner.lockInfo` → `"Some rewards are locked for {{days}} more days."` uses `{{days}}` but the AR version (second duplicate `partner` block, line 1530) uses `{{days}}` correctly. However the first `partner` block (line 1390) also uses `{{days}}` — no conflict here but duplicates remain.
7. `partner.commission.rateInfo` (EN line 1485): `"You earn ₪{{rate}} per student..."` — `{{rate}}` is a numeric placeholder. The `₪` symbol is hardcoded before the placeholder, which means in AR context the unit placement could feel reversed (RTL). Recommendation: use `{{rate}} ₪` or let the translation handle symbol position.

---

### D. Numeric Safety

- `**toLocaleString()` called without locale argument** in 29 files. In Arabic browser locale, `toLocaleString()` with no args will produce Arabic-Indic numerals (٠١٢٣...) on some devices/browsers. This is a **critical** numeric safety violation for all KPI values.
  - Affected components: `AdminOverview.tsx`, `EarningsPanel.tsx`, `TeamStudentProfilePage.tsx`, `AdminSubmissionsPage.tsx`, `SecurityPanel.tsx`, `ProfileCompletionForm.tsx`, and 23 more files.
  - Fix: always pass `'en-US'` or `{ useGrouping: true }` as in `toLocaleString('en-US')` to guarantee ASCII digits.
  - Note: `EarningsPanel.tsx` does use `const locale = i18n.language === 'ar' ? 'ar' : 'en-US'` but then calls `.toLocaleString()` without it for some values (line 208, 212, 216, 284, 305). The locale variable is only used for `toLocaleDateString` calls.
- **Currency format inconsistency**: Some components use `5000 ₪`, others use `ILS` text-only, others use both. Recommendation: standardize to `{value.toLocaleString('en-US')} ₪` throughout.
- `**ProfileCompletionForm.tsx` lines 513, 598, 605**: hardcoded English strings `"Program"`, `"Accommodation ({...}mo)"`, `"Insurance ({...}mo)"` — not translated.

---

### E. Overflow / UI Fit Risks

**Mobile Bottom Nav (360–412px, `max-w-[48px]` per label):**


| Key                | EN text                        | AR text           | Risk                                                           |
| ------------------ | ------------------------------ | ----------------- | -------------------------------------------------------------- |
| `nav.checklist`    | "Checklist" (9 chars)          | "قائمة المتطلبات" | CRITICAL — AR is 16 chars, truncates to "قائمة الم..." at 48px |
| `nav.appointments` | "Appts" (5 chars)              | "المواعيد"        | MEDIUM — 8 chars fits but tight at 10px font                   |
| `nav.submitNew`    | "New" (3 chars)                | "جديد"            | OK                                                             |
| `nav.students`     | "Students" (8 chars)           | "الطلاب"          | OK                                                             |
| `nav.analytics`    | "Analytics" (9 chars)          | "التحليلات"       | MEDIUM — 9 chars, tight at 10px/48px                           |
| `nav.financials`   | "Finance" (7 chars, last wins) | "المالية"         | OK                                                             |
| `nav.overview`     | "Overview" (8 chars)           | "الرئيسية"        | OK                                                             |


**KPI Cards (SparklineCard — `text-2xl lg:text-3xl`):**

- Large monetary values like `1,234,567 ₪` (9 chars + symbol + space = ~12 chars) at `text-2xl` (24px) will overflow the 100%–width card on 360px screens when combined with the sparkline icon area.
- Subtext like `"+12 this month"` → AR: `"+ 12 هذا الشهر"` — OK length-wise.
- `admin.overview.revenueThisMonth` value: e.g. `"125,000 ₪"` at 2xl — no truncation class, could overflow in narrow grid cell.
- SparklineCard uses `truncate` only on the label `<p>` but NOT on the value `<p>`. Large values (e.g. `1,500,000 ₪`) will wrap or overflow.

**Sidebar Nav Labels (collapsed sidebar + tooltip):**

- `admin.tabs.securityAudit` → "Security & Audit" (16 chars), AR: "الأمان والسجل" — Both fine in expanded mode; collapsed uses tooltip only.

**Long AR strings at risk in dialogs/cards:**


| Key                          | AR text                                                                   | Risk at 360px                                              |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `referrals.familyLabel`      | "إحالة فرد من العائلة (خصم 1,000₪ للمُحال)"                               | MEDIUM — 43 chars in a checkbox label, wraps to 3 lines    |
| `influencers.deactivateDesc` | "هل أنت متأكد من إلغاء تنشيط {{name}}?..."                                | MEDIUM — with a long name, wraps aggressively              |
| `lawyer.paidNotice`          | "تم إرسال إشعار للإدارة لتأكيد الدفع. لن يتم تفعيل العمولات حتى التأكيد." | HIGH — 72 chars in a notice banner, needs 3 lines on 360px |
| `partner.noStudents`         | "No students referred yet. Share your link to get started!"               | MEDIUM — 57 chars                                          |


---

### F. KPI/Card-Specific Issues

1. **SparklineCard value field**: No overflow protection. Add `whitespace-nowrap; overflow: hidden; text-overflow: ellipsis;` or clamp font size for large monetary values.
2. **TeamAnalyticsTab KPI cards**: Label area is `text-[10px]` with `leading-tight` — AR labels like `"إجمالي الإيرادات"` (18 chars) will wrap to 2 lines inside a `p-3 text-center` card on 360px, pushing the card height taller than adjacent cells and breaking grid alignment.
3. **EarningsPanel KPI strip**: Values at `text-2xl font-bold` like `"12,500 ₪"` — fine. But if `totalEarned` grows to 6+ digits, consider `text-xl` clamp.
4. **AdminOverview Revenue card subtext**: `+${newThisMonth} this month` — AR: `+12 هذا الشهر` — The `+` prefix looks visually odd in RTL context (appears at left of number in LTR rendering but should follow number in RTL).
5. **Funnel labels** (`funnel.*`): `"appointment_scheduled"` → "Appt Scheduled" (14 chars) inside a small funnel cell. On 360px this will wrap. AR: "موعد محجوز" (10 chars) — better.

---

### G. Structural Issues

1. `**team.roleInfluencer**` (AR, line 1071): `"وكيل (Influencer)"` — mixed Arabic + English in parentheses. The word "Influencer" should be translated or consistently use "وكيل" only to avoid mixed-script rendering issues.
2. `**admin.analytics.slaWarnings` AR**: `"تنبيهات SLA"` — "SLA" is kept as ASCII acronym. Acceptable but could add Arabic expansion in a tooltip.
3. **Date formatting**: `toLocaleDateString(locale)` in `EarningsPanel` (line 287, 307) uses `locale` which is `'ar'` for Arabic users. This will produce Arabic-Indic date digits like `١٥/٣/٢٠٢٦`. Should use `'en-US'` to guarantee ASCII date digits, or use `date-fns/format` which always outputs ASCII.
4. **Monthly chart labels**: `d.toLocaleDateString('en', { month: 'short' })` in `AdminOverview.tsx` line 117 — hardcoded `'en'` locale, which is correct. No issue here.

---

### Plan: What to Fix

**1. Fix duplicate root-level JSON keys** — merge the 3 `"nav"` blocks, 2 `"admin"` blocks, 2 `"common"` blocks, 2 `"case"` blocks, and 2 `"partner"` blocks in both `en/dashboard.json` and `ar/dashboard.json`. This is the highest-priority fix as it silently corrupts key lookups.

**2. Add 8 missing translation keys** to both EN and AR JSON files:

- `influencer.earnings.available`
- `influencer.earnings.requestCancelled`
- `influencer.earnings.actions`
- `influencer.earnings.payoutRequests`
- `influencer.earnings.minThreshold` (with `{{amount}}` placeholder)
- `application.serviceFee`
- `lawyer.kpi.conversionRate`
- `lawyer.kpi.showRate`

**3. Fix numeric safety** — change all bare `.toLocaleString()` calls to `.toLocaleString('en-US')` across all affected files. This prevents Arabic-Indic numeral rendering on Arabic-locale browsers.

**4. Fix date formatting** — change `toLocaleDateString(locale)` where `locale='ar'` to always use `'en-US'` or `date-fns format()`.

**5. Add CSS overflow protection to SparklineCard value** — add `whitespace-nowrap overflow-hidden text-overflow-ellipsis` or a font-size clamp for large monetary values.

**6. Mobile bottom nav AR truncation** — `nav.checklist` AR (`"قائمة المتطلبات"`) overflows `max-w-[48px]`. Add a shorter AR variant or reduce to `"المتطلبات"` (11 chars).

**7. Fix mixed-script string** `team.roleInfluencer` AR value.

**8. Add plural keys** for `{{count}}` strings that represent units (attempts, students, days, files).