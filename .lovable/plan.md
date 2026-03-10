
## Comprehensive Dashboard Scan — Batched Fix Plan

### What was found (full audit)

**1. JSON Duplicate Root Keys (still present — structural bug)**
Both `en/dashboard.json` and `ar/dashboard.json` still have:
- `"nav"` 3× (lines 1228, 1448, 1553 EN)
- `"admin"` 2× (lines 245, 1277 EN)  
- `"common"` 2× (lines 761, 1266 EN)
- `"case"` 2× (lines 1253, 1540 EN)
- `"partner"` 2× (lines 1374, 1482 EN)
Last one wins silently — nav labels, case statuses, partner data all load the wrong block.

**2. Missing translation keys (8 confirmed)**
Used in code but absent from both locale files:
- `influencer.earnings.available` (EarningsPanel:212)
- `influencer.earnings.requestCancelled` (EarningsPanel:192)
- `influencer.earnings.actions` (EarningsPanel:300)
- `influencer.earnings.payoutRequests` (EarningsPanel:277)
- `influencer.earnings.minThreshold` with `{{amount}}` (EarningsPanel:263)
- `application.serviceFee` (MyApplicationTab:184)
- `lawyer.kpi.conversionRate` (TeamAnalyticsTab:49)
- `lawyer.kpi.showRate` (TeamAnalyticsTab:50)

**3. Arabic-Indic numeral risk — `.toLocaleString()` without locale**
29 files. Key offenders:
- `AdminOverview.tsx` line 151, 195 — revenue KPIs
- `EarningsPanel.tsx` lines 208, 212, 216, 305 — uses `locale='ar'` for dates but bare `.toLocaleString()` for amounts
- `TeamAnalyticsTab.tsx` lines 47, 48 — KPI earnings
- `TeamStudentProfilePage.tsx` lines 67, 70 — Service Fee / Translation hardcoded EN strings + bare `.toLocaleString()`
- `PaymentConfirmationForm.tsx` lines 95, 103, 104
- `PaymentsSummary.tsx` lines 77, 109
- `PayoutActionModals.tsx` line 32
- `AdminSpreadsheetPage.tsx` lines 143, 214
- `CostCalculator.tsx` lines 221, 227, 231

**4. `toLocaleDateString` with `'ar'` locale → Arabic-Indic date digits**
- `EarningsPanel.tsx` lines 287, 307: `locale = 'ar'` → produces `١٥/٣/٢٠٢٦`
- `DocumentsManager.tsx` lines 199, 295: `locale = 'ar-SA'` → same issue
- `PartnerEarningsPage.tsx` line 167: `isAr ? 'ar' : 'en-GB'`
- `PartnerStudentsPage.tsx` line 142: `isAr ? 'ar' : 'en-GB'`
- `StudentVisaPage.tsx` line 87: `isAr ? 'ar' : 'en-GB'`
- `AuditLog.tsx`, `LeadsManagement.tsx`, `ReferralManagement.tsx`, `PayoutsManagement.tsx`: all set `locale = 'ar'` for Arabic and pass it to `toLocaleDateString`

**5. `SparklineCard` value overflow — no truncation**
`<p className="text-2xl lg:text-3xl font-extrabold text-foreground mt-1">{value}</p>` — no `truncate`/`min-w-0`. Large values like `1,234,567 ₪` overflow cards on 360px.

**6. Mobile bottom nav AR overflow — `nav.checklist`**
AR translation at line 1246 (first `nav` block) = `"قائمة المتطلبات"` (16 chars). Container is `max-w-[48px]`. Last winning `nav` block (1553) has `"المتطلبات"` (10 chars) which is better, but the duplicate key confusion means it's unpredictable. Need single block with short labels.

**7. `TeamStudentProfilePage.tsx` hardcoded English strings**
Lines 55, 64, 67, 70, 72, 73, 79: "Contact", "Submission", "Service Fee", "Translation", "Start", "End", "View Full Case" — no `t()` calls, no translation.

**8. `team.roleInfluencer` AR: mixed-script `"وكيل (Influencer)"`**
Should be `"وكيل"` only.

**9. `TeamAnalyticsTab` KPI card label overflow on mobile**
`text-[10px] leading-tight` in `p-3 text-center` card — long Arabic labels like `"معدل التحويل"` (15 chars) push card height inconsistently, breaking grid alignment at 360px. Add `min-h` and `line-clamp-2`.

---

### Files to change (batched)

**A. Locale files (2 files) — consolidate duplicate keys + add missing**

`public/locales/en/dashboard.json`:
- Merge 3× `nav` into single canonical block with all keys (use the last block's short labels for mobile — "Checklist", "Profile", "Docs", "Visa", "Refer", "Contacts", plus full labels for all others)
- Merge 2× `admin` blocks
- Merge 2× `common` blocks  
- Merge 2× `case` blocks
- Merge 2× `partner` blocks
- Add to `influencer.earnings`: `available`, `requestCancelled`, `actions`, `payoutRequests`, `minThreshold` (with `{{amount}}`)
- Add `application.serviceFee`
- Add `lawyer.kpi.conversionRate` and `lawyer.kpi.showRate`

`public/locales/ar/dashboard.json`: same consolidation + Arabic translations for the 8 missing keys + fix `team.roleInfluencer` to `"وكيل"` (drop mixed script)

**B. Numeric safety (7 component files)**

For each file: replace bare `.toLocaleString()` with `.toLocaleString('en-US')` AND fix date locale from `'ar'` / `isAr ? 'ar' : ...` to always `'en-US'`:

1. `src/components/influencer/EarningsPanel.tsx` — fix `locale` var used in `toLocaleDateString`; fix bare `.toLocaleString()` on amounts
2. `src/components/team/TeamAnalyticsTab.tsx` — fix lines 47, 48
3. `src/components/admin/AdminOverview.tsx` — fix lines 151, 195 (chart tooltip on line 181 also)
4. `src/components/dashboard/DocumentsManager.tsx` — change `locale = 'ar-SA'` to always `'en-US'`
5. `src/pages/partner/PartnerEarningsPage.tsx` — change `isAr ? 'ar' : 'en-GB'` to `'en-US'`
6. `src/pages/partner/PartnerStudentsPage.tsx` — same
7. `src/pages/student/StudentVisaPage.tsx` — same
8. `src/components/team/PaymentConfirmationForm.tsx` — lines 95, 103, 104
9. `src/components/dashboard/PaymentsSummary.tsx` — lines 77, 109
10. `src/components/admin/PayoutActionModals.tsx` — line 32

**C. SparklineCard overflow fix**

`src/components/admin/SparklineCard.tsx`:
- Add `truncate` + `min-w-0` to value `<p>`: `className="text-xl lg:text-2xl font-extrabold text-foreground mt-1 truncate min-w-0"`
- Reduce from `text-2xl lg:text-3xl` to `text-xl lg:text-2xl` to prevent overflow on 360px with large monetary values

**D. TeamStudentProfilePage — add translations**

`src/pages/team/TeamStudentProfilePage.tsx`:
- Add `useTranslation` import
- Replace hardcoded "Contact", "Submission", "Service Fee", "Translation", "Start", "End", "View Full Case", "Loading...", "Not found" with `t()` calls using existing keys from `lawyer.*` and `application.*` namespaces

**E. TeamAnalyticsTab KPI cards — mobile overflow**

`src/components/team/TeamAnalyticsTab.tsx`:
- Add `min-h-[88px]` to `KPICard` CardContent
- Add `line-clamp-2` to label `<p>` so Arabic wraps gracefully without collapsing value

---

### Implementation order
1. Fix both JSON locale files (A) — unblocks everything else
2. Fix numeric/date safety across 10 component files (B) 
3. SparklineCard overflow (C)
4. TeamStudentProfilePage hardcoded strings (D)
5. TeamAnalyticsTab card height (E)
