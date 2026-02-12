# Comprehensive i18n Audit and Fix Plan

## Audit Findings

After scanning the entire codebase, here is the full picture of translation coverage:

### GOOD -- Already using i18n (react-i18next)

- All **public-facing pages**: Index, About, Services, Contact, Partners, Partnership, Resources, Broadcast, Educational Destinations, Educational Programs, Quiz, AI Advisor, Locations, Cost Calculator, Currency Converter, Bagrut Calculator, Lebenslauf Builder
- All **public-facing components**: Header, Footer, DesktopNav, MobileNav, BottomNav, LanguageSwitcher, ChatWidget, PWAInstaller, CookieBanner, OfflineIndicator
- **SEOHead** component with per-page meta titles/descriptions

### BAD -- Zero i18n (100% hardcoded Arabic strings)

**Dashboard (16 files, ~50+ hardcoded strings):**

- `WelcomeCard.tsx` -- "مرحبا", "تابع تقدمك..."
- `DashboardHeader.tsx` -- "لوحة التحكم الطلابية", "تسجيل الخروج", "العودة إلى الموقع", toast messages
- `DashboardSidebar.tsx` -- 6 tab labels hardcoded in Arabic
- `DashboardMainContent.tsx` -- section content
- `ServicesOverview.tsx` -- "خدماتي", "إضافة خدمة", empty states
- `DocumentsManager.tsx` -- titles, badges, placeholders, upload modal labels
- `AddPaymentModal.tsx` -- form labels, placeholders
- `AddServiceModal.tsx` -- form labels, select options
- `ReferralForm.tsx` -- all form labels, select options (gender, German level, destination)
- `ReferralTracker.tsx` -- status labels
- `RewardsPanel.tsx` -- earnings labels
- `PaymentsSummary.tsx` -- payment labels
- `ChecklistTracker.tsx` -- checklist labels
- `StudentProfile.tsx` -- profile labels

**Admin (10 files, ~80+ hardcoded strings):**

- `AdminLayout.tsx` -- 9 tab labels, "لوحة الإدارة", "العودة للموقع", "تسجيل الخروج"
- `AdminOverview.tsx` -- stats cards, labels
- `StudentManagement.tsx` -- table headers, actions
- `InfluencerManagement.tsx` -- table headers, actions
- `ChecklistManagement.tsx` -- form labels
- `ContactsManager.tsx` -- table headers
- `ReferralManagement.tsx` -- table headers
- `PayoutsManagement.tsx` -- payment labels
- `SecurityPanel.tsx` -- security labels
- `AuditLog.tsx` -- log labels

**Influencer Dashboard (3 files, ~20+ hardcoded strings):**

- `EarningsPanel.tsx` -- earnings/status labels
- `MediaHub.tsx` -- media labels
- `ReferralLink.tsx` -- referral labels

**CV Templates (3 files -- hardcoded English section headers):**

- `GermanStandardTemplate.tsx` -- "Education", "Experience", "Skills", "Certificates", "Volunteer Work", "References", "Present"
- `AcademicTemplate.tsx` -- same section headers + "Technical Skills", "Publications"
- `EuropassTemplate.tsx` -- same + "Language Skills", "Digital & Other Skills", field labels like "Phone:", "Email:", "Address:", "Date of Birth:", "Nationality:"

**Manifest (1 file -- Arabic only, no English):**

- `manifest.json` -- name, short_name, description, shortcut names are all Arabic-only

**Other hardcoded items found:**

- 45 `aria-label` attributes in UI components (carousel, breadcrumb, pagination, sidebar) -- English-only, not translated
- `InAppBrowserBanner.tsx` -- inline ternary (`isAr ? ... : ...`) instead of i18n

---

## Implementation Plan

### Phase 1: Create new translation namespace files

Create two new namespace files for dashboard/admin/influencer content:


| File                               | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| `public/locales/ar/dashboard.json` | All dashboard, admin, influencer strings in Arabic  |
| `public/locales/en/dashboard.json` | All dashboard, admin, influencer strings in English |


Add `'dashboard'` to the `ns` array in `src/i18n.ts`.

### Phase 2: Dashboard components (16 files)

Replace every hardcoded Arabic string with `t('key')` using the `dashboard` namespace.

Example transformation for `DashboardHeader.tsx`:

```
Before: <h1>لوحة التحكم الطلابية</h1>
After:  <h1>{t('dashboard:header.title')}</h1>
```

Files to modify:

1. `WelcomeCard.tsx`
2. `DashboardHeader.tsx`
3. `DashboardSidebar.tsx`
4. `DashboardMainContent.tsx`
5. `ServicesOverview.tsx`
6. `DocumentsManager.tsx`
7. `AddPaymentModal.tsx`
8. `AddServiceModal.tsx`
9. `ReferralForm.tsx`
10. `ReferralTracker.tsx`
11. `RewardsPanel.tsx`
12. `PaymentsSummary.tsx`
13. `ChecklistTracker.tsx`
14. `StudentProfile.tsx`

### Phase 3: Admin components (10 files)

Same approach for all admin components -- add `useTranslation('dashboard')` and replace hardcoded strings:

1. `AdminLayout.tsx`
2. `AdminOverview.tsx`
3. `StudentManagement.tsx`
4. `InfluencerManagement.tsx`
5. `ChecklistManagement.tsx`
6. `ContactsManager.tsx`
7. `ReferralManagement.tsx`
8. `PayoutsManagement.tsx`
9. `SecurityPanel.tsx`
10. `AuditLog.tsx`

### Phase 4: Influencer dashboard (3 files)

1. `EarningsPanel.tsx`
2. `MediaHub.tsx`
3. `ReferralLink.tsx`

### Phase 5: CV Template section headers

The CV templates have hardcoded English section headers ("Education", "Experience", etc.). These should adapt to the CV's `contentLanguage` property.

Approach: Pass a lookup object based on `data.contentLanguage` to each template with all section header labels in DE/EN/AR.

Files to modify:

1. `GermanStandardTemplate.tsx`
2. `AcademicTemplate.tsx`
3. `EuropassTemplate.tsx`

Add a shared `cvLabels` utility:

```typescript
// src/components/lebenslauf/cvLabels.ts
export const cvLabels = {
  de: { education: 'Bildung', experience: 'Berufserfahrung', ... },
  en: { education: 'Education', experience: 'Experience', ... },
  ar: { education: 'التعليم', experience: 'الخبرة العملية', ... },
};
```

### Phase 6: Manifest localization note

The `manifest.json` is Arabic-only. Since the Web App Manifest spec does not support dynamic localization (it's a static file), this is acceptable for an Arabic-primary PWA. No change needed.

### Phase 7: aria-label cleanup

The hardcoded `aria-label` strings in UI primitives (carousel, breadcrumb, pagination) are from shadcn/ui defaults. These are low-priority since they are generic navigation labels used by screen readers. No change for now -- can be addressed in a future accessibility pass.

---

## Translation Key Structure (dashboard.json)

```
{
  "header": {
    "title": "Student Dashboard" / "لوحة التحكم الطلابية",
    "signOut": "Sign Out" / "تسجيل الخروج",
    "returnToSite": "Return to Website" / "العودة إلى الموقع",
    "signOutSuccess": "Signed out successfully" / "تم تسجيل الخروج بنجاح",
    ...
  },
  "sidebar": {
    "checklist": "Checklist" / "قائمة المتطلبات",
    "overview": "Overview" / "نظرة عامة",
    "services": "Services" / "الخدمات",
    ...
  },
  "welcome": {
    "greeting": "Hello, {{name}}!",
    "subtitle": "Track your progress..."
  },
  "admin": {
    "title": "Admin Panel" / "لوحة الإدارة",
    "tabs": { ... },
    ...
  },
  "influencer": {
    "earnings": { ... },
    ...
  }
}
```

---

## Implementation Order

1. Create `public/locales/ar/dashboard.json` and `public/locales/en/dashboard.json` with all keys
2. Register `'dashboard'` namespace in `src/i18n.ts`
3. Create `src/components/lebenslauf/cvLabels.ts` for CV template labels
4. Update all 16 dashboard component files
5. Update all 10 admin component files
6. Update all 3 influencer component files
7. Update 3 CV template files

**Estimated scope:** ~30 files modified, ~200+ strings extracted to translation keys.

---

## What Will NOT Change

- Navigation order, logo, student portal button
- Brand colors and design language
- Existing public-facing translations (already working)
- manifest.json content (Arabic-primary, static file)
- shadcn/ui aria-label defaults (low priority)   Got it — you want a **focused highlight checklist** for the main page, cards, and key sections to make sure everything has **proper translation** and nothing is missed. Here’s a **concise, high-impact “must-check” guide** for your team or yourself:
  ---
  # 🔹 Translation & Content Highlight Checklist
  ## 1️⃣ Main Page / Hero Sections
  - **أرقامنا تتحدث** → “Our Numbers Speak”
  - **الشفافية والنجاح هما أساس عملنا، وهذه الأرقام تعكس ثقة طلابنا بنا.** → “Transparency and success are the foundation of our work, and these numbers reflect our students’ trust.”
  - Numbers + labels (cards):
    - 47+ → **Satisfied Students / طلاب راض**
    - 16+ → **Partners / شريك**
    - 5+ → **Countries Around the World / دول حول العالم**
    - 98% → **Success Rate / نسبة النجاح**
  - Check: numbers **remain unchanged**, text translates clearly, layout doesn’t break with Arabic or long English phrases.
  ---
  ## 2️⃣ Step-by-Step Journey Cards
  Section: **رحلتك نحو الدراسة في الخارج / Your Journey to Study Abroad**
  - **الاستشارة والتقييم** → “Consultation & Assessment”
  - Description: “تبدأ رحلتك بجلسة استشارية مجانية لفهم أهدافك وتقييم ملفك.” → “Your journey starts with a free consultation to understand your goals and assess your profile.”
  - **تجهيز وتقديم الطلبات** → “Document Preparation & Submission”
  - Description: “نساعدك في إعداد كافة المستندات وتقديم طلباتك للجامعات والسفارة.” → “We help you prepare all documents and submit your applications to universities and embassies.”
  - **الاستعداد للسفر** → “Travel Preparation”
  - Description: “بعد الحصول على القبول والتأشيرة، نساعدك في حجز السكن والتحضير للسفر.” → “After receiving your acceptance and visa, we help you book accommodation and prepare for travel.”
  - **الدعم بعد الوصول** → “Post-Arrival Support”
  - Description: “نستقبلك ونقدم لك الدعم اللازم لتستقر.” → “We welcome you and provide the necessary support to settle in.”
  **Check:** Cards are fully translated, titles + descriptions, no text overflows, and responsive on mobile.
  ---
  ## 3️⃣ Educational Destinations / Universities Cards
  Section: **Our Educational Destinations in Germany**
  - **Explore the best universities, language schools, and educational services in Germany** → Translate to Arabic.
  - Cards: **Leading German Universities / Language Schools / Services**
    - Titles
    - Descriptions / short snippets
    - Any “Read More” / CTA buttons
  - Ensure icons, images, and links are contextually accurate.
  **Check:** All cards on this section are visible, RTL-compliant for Arabic, English translations don’t break layout.
  ---
  ## 4️⃣ Broadcast / Major Pages
  Section: **Darb Broadcast / News / Updates**
  - Titles, subtitles, and summary text
  - Cards: article headlines, descriptions, dates
  - Buttons / CTAs like “Read More” / “اقرأ المزيد”
  - Tags, categories, meta info
  **Check:** Cards are fully translated, long headlines don’t break the card, dynamic text (like numbers or dates) formatted for locale.
  ---
  ## 5️⃣ Global Checks
  - **Buttons / CTAs**: All “Apply Now”, “Learn More”, “Contact Us”, etc., have translation.
  - **Placeholders**: forms (email, name, message) translated.
  - **Meta tags / SEO**: page title, description, Open Graph for EN & AR.
  - **PWA / manifest**: `short_name`, `name` localized.
  - **Accessibility attributes**: `aria-label`, `alt`, `title` fully translated.
  - **Layout / RTL**: Arabic translations don’t break cards, spacing, or icons.
  ---
  ✅ **Tip:** For numeric cards (like 47+, 16+, 5+, 98%), **don’t translate numbers**, only labels. Keep the icons, colors, and spacing consistent in both languages.