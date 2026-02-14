

## Global Language Toggle Consistency Fix

This plan ensures zero mixed-language UI by replacing all hardcoded Arabic and English strings with i18n translation keys, and adding missing translation entries to both locale files.

---

### Current System Assessment

The project uses `i18next` with `react-i18next` and `i18next-http-backend`. Translation files are loaded from `/locales/{lng}/{ns}.json` with 10 namespaces. The `useDirection` hook handles RTL/LTR, and language persists in `localStorage`. The core i18n architecture is solid. The problem is **incomplete adoption**: many components still have hardcoded Arabic or English strings instead of using `t()` calls.

---

### Severity Categories

**Category A -- Components with ALL strings hardcoded (no i18n at all):**

| File | Language | Issue |
|------|----------|-------|
| `src/pages/ResetPasswordPage.tsx` | Arabic only | All labels, toasts, buttons hardcoded in Arabic |
| `src/pages/LawyerDashboardPage.tsx` | Arabic only | All labels, statuses, headings hardcoded in Arabic |
| `src/components/admin/KPIAnalytics.tsx` | Arabic only | All metric labels hardcoded in Arabic |
| `src/components/calculator/GpaCalculator.tsx` | Arabic only | Title, description, validation errors, formula explanation all hardcoded |
| `src/components/educational/CategoryFilter.tsx` | Arabic only | Heading and "All Majors" button hardcoded |
| `src/components/dashboard/DashboardErrorBoundary.tsx` | Arabic only | Error messages hardcoded |
| `src/pages/StudentDashboardPage.tsx` | Arabic only | Error messages and retry button hardcoded |
| `src/components/admin/CasesManagement.tsx` | Arabic only | Export dialog text hardcoded |
| `src/components/partnership/SuccessStories.tsx` | Arabic only | All stories and labels hardcoded |

**Category B -- Components using inline ternary (`isAr ? ... : ...`) instead of `t()` keys:**

| File | Issue |
|------|-------|
| `src/components/services/ConsultationCta.tsx` | All form labels use `isAr ? 'Arabic' : 'English'` pattern |
| `src/components/landing/Contact.tsx` | Form labels hardcoded in English only, validation messages mixed |

**Category C -- Partial hardcoding (uses `t()` for some strings but not all):**

| File | Hardcoded Strings |
|------|-------------------|
| `src/components/admin/AdminLayout.tsx` | Sidebar group labels (`لوحة التحكم`, `الطلاب`, `الفريق`, `المالية`, `أدوات`) |
| `src/components/admin/InfluencerManagement.tsx` | Section heading `إدارة الفريق` |
| `src/pages/InfluencerDashboardPage.tsx` | Tab labels, metric labels hardcoded in Arabic |
| `src/components/partners/components/UniversityCarousel.tsx` | Button text `زيارة الموقع` |
| `src/pages/PartnersPage.tsx` | Inline Arabic paragraph text |

---

### Implementation Plan

#### Step 1: Add Missing Translation Keys

Add all missing keys to both `en` and `ar` locale files across the following namespaces:

**`common.json`** -- Add keys for:
- Reset password page (title, labels, validation, toasts, button states)
- Dashboard error messages
- Generic form labels (Full Name, Phone, City, etc.)
- Generic actions (Save, Cancel, Edit, Delete, Retry)
- Yes/No, Submitting/Sending states

**`dashboard.json`** -- Add keys for:
- Admin sidebar group labels (dashboard, students, team, finance, tools)
- KPI metric labels (net profit, revenue, expenses, profit per student, close rate, etc.)
- Lawyer dashboard (title, case statuses, field labels, source types)
- Influencer dashboard (tab labels, metric labels)
- Case management export dialog
- Student dashboard error states

**`resources.json`** -- Add keys for:
- GPA Calculator title, description, validation errors, formula explanation
- All tooltip text

**`partners.json`** -- Add keys for:
- University "Visit Website" button
- Partners page inline subtitle text

**`partnership.json`** -- Add keys for:
- Success stories content (names, stories, labels)

**`services.json`** -- Add keys for:
- All ConsultationCta form labels, placeholders, options, button text

**`contact.json`** -- Add keys for:
- All form labels, placeholders, select options, validation messages

#### Step 2: Refactor Components to Use `t()` Keys

For each file in Category A/B/C above:
1. Import `useTranslation` (if not already imported)
2. Replace every hardcoded string with the corresponding `t('key')` call
3. Replace all `isAr ? ... : ...` ternary patterns with `t()` calls
4. Replace hardcoded select option arrays with translation-driven arrays

#### Step 3: Fix Admin Sidebar Group Labels

In `AdminLayout.tsx`, change the hardcoded `label` strings in `sidebarGroups` to use translation keys (e.g., `labelKey: 'admin.groups.dashboard'`) and resolve them via `t()` in the render.

#### Step 4: Fix CategoryFilter

Replace hardcoded Arabic heading and button text with `t()` keys from an appropriate namespace (likely `common` or a new `educational` namespace using the existing majors data bilingual structure).

#### Step 5: Fix ConsultationCta Pattern

Replace all inline ternary translations with proper `t()` calls. Move select options to the translation files as arrays or use stable value keys with translated display labels.

#### Step 6: Fix Contact Form

Replace all English-only form labels ("Full Name", "Phone Number", etc.) and select option text with `t()` calls from the `contact` namespace.

---

### Technical File Summary

| File | Action |
|------|--------|
| `public/locales/en/common.json` | Add ~30 missing keys |
| `public/locales/ar/common.json` | Add ~30 missing keys |
| `public/locales/en/dashboard.json` | Add ~50 missing keys (admin, lawyer, influencer, KPI) |
| `public/locales/ar/dashboard.json` | Add ~50 missing keys |
| `public/locales/en/resources.json` | Add ~15 missing keys (GPA calculator) |
| `public/locales/ar/resources.json` | Add ~15 missing keys |
| `public/locales/en/contact.json` | Add ~20 missing keys (form fields) |
| `public/locales/ar/contact.json` | Add ~20 missing keys |
| `public/locales/en/services.json` | Add ~15 missing keys (consultation form) |
| `public/locales/ar/services.json` | Add ~15 missing keys |
| `public/locales/en/partners.json` | Add ~5 missing keys |
| `public/locales/ar/partners.json` | Add ~5 missing keys |
| `public/locales/en/partnership.json` | Add ~10 missing keys (success stories) |
| `public/locales/ar/partnership.json` | Add ~10 missing keys |
| `src/pages/ResetPasswordPage.tsx` | Replace all hardcoded Arabic with `t()` |
| `src/pages/LawyerDashboardPage.tsx` | Replace all hardcoded Arabic with `t()` |
| `src/pages/InfluencerDashboardPage.tsx` | Replace hardcoded tab/metric labels with `t()` |
| `src/pages/StudentDashboardPage.tsx` | Replace hardcoded error text with `t()` |
| `src/components/admin/KPIAnalytics.tsx` | Replace all hardcoded Arabic with `t()` |
| `src/components/admin/AdminLayout.tsx` | Replace sidebar group labels with `t()` |
| `src/components/admin/InfluencerManagement.tsx` | Replace heading with `t()` |
| `src/components/admin/CasesManagement.tsx` | Replace dialog text with `t()` |
| `src/components/calculator/GpaCalculator.tsx` | Replace all hardcoded text with `t()` |
| `src/components/educational/CategoryFilter.tsx` | Replace heading/button with `t()` |
| `src/components/services/ConsultationCta.tsx` | Replace ternaries with `t()` |
| `src/components/landing/Contact.tsx` | Replace English labels with `t()` |
| `src/components/partners/components/UniversityCarousel.tsx` | Replace button text with `t()` |
| `src/components/partnership/SuccessStories.tsx` | Replace stories with `t()` |
| `src/components/dashboard/DashboardErrorBoundary.tsx` | Replace error text with `t()` |

### Implementation Order

1. Add all missing keys to locale JSON files (both `en` and `ar`)
2. Refactor Category A files (fully hardcoded -- highest impact)
3. Refactor Category B files (ternary pattern)
4. Refactor Category C files (partial hardcoding)
5. Verify by switching language on every affected page

