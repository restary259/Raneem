
# Plan: Full Bilingual Scan Fix -- Translate All Remaining Hardcoded Arabic

## Problem Summary
After scanning the entire codebase, there are **20+ components and 3 data files** with hardcoded Arabic text that does NOT respond to the language switcher. When a user switches to English, these sections remain in Arabic, breaking the bilingual experience.

---

## Affected Areas (Grouped by Priority)

### Group 1: Pages with hardcoded `dir="rtl"` (must be dynamic)

These pages have `dir="rtl"` hardcoded on their root div. They need to use the `useDirection()` hook instead.

| Page | Line |
|------|------|
| `src/pages/Index.tsx` | `dir="rtl"` |
| `src/pages/ContactPage.tsx` | `dir="rtl"` |
| `src/pages/ServicesPage.tsx` | `dir="rtl"` |
| `src/pages/LocationsPage.tsx` | `dir="rtl"` |
| `src/pages/PartnershipPage.tsx` | `dir="rtl"` |
| `src/pages/BroadcastPage.tsx` | `dir="rtl"` (2 places) |
| `src/pages/EducationalProgramsPage.tsx` | `dir="rtl"` |
| `src/pages/BagrutCalculatorPage.tsx` | `dir="rtl"` |
| `src/pages/CostCalculatorPage.tsx` | `dir="rtl"` |
| `src/pages/CurrencyConverterPage.tsx` | `dir="rtl"` |
| `src/pages/AdminDashboardPage.tsx` | `dir="rtl"` |
| `src/pages/WhoWeArePage.tsx` | `dir="rtl" lang="ar"` |
| `src/components/landing/ContactHero.tsx` | `dir="rtl"` |
| `src/components/common/PWAInstaller.tsx` | `dir="rtl"` |
| `src/components/educational/MajorModal.tsx` | `dir="rtl"` |
| `src/components/partnership/RegistrationForm.tsx` | Select `dir="rtl"` |
| `src/components/services/ConsultationCta.tsx` | Select `dir="rtl"` |
| `src/components/landing/Contact.tsx` | Select `dir="rtl"` (2 places) |
| `src/components/calculator/CostCalculator.tsx` | Select `dir="rtl"` (4 places) |
| `src/components/calculator/GpaCalculator.tsx` | `dir="rtl"` |

All these will use `useDirection()` hook to dynamically set direction.

---

### Group 2: Components with fully hardcoded Arabic content

These components have ALL their text in Arabic with no `t()` calls.

**`src/pages/WhoWeArePage.tsx`** -- ~90 lines of hardcoded Arabic
- Hero title, subtitle, story section, values, features, team members, CTA
- All `features[]`, `teamMembers[]`, `ourValues[]`, `storyPoints[]` arrays

**`src/components/services/ServicesGrid.tsx`** -- All 9 service cards hardcoded
- titles, descriptions, features arrays, "ابدأ الآن" button text
- Section title "خدماتنا الشاملة" and subtitle

**`src/components/services/ServiceProcess.tsx`** -- 4 steps hardcoded
- Step titles and descriptions, default title/description props

**`src/components/services/ConsultationCta.tsx`** -- Full form hardcoded
- 8 service options, form labels, placeholders, validation messages, toast messages
- Section title, description, submit button text

**`src/components/services/TestimonialSection.tsx`** -- 3 testimonials hardcoded
- Names, texts, section title/subtitle

**`src/components/landing/Locations.tsx`** -- 4 location cards hardcoded
- Country names, cities, services, section title

**`src/components/landing/OfficeLocations.tsx`** -- Office info hardcoded
- Address, hours, "مكتبنا الرئيسي" title, WhatsApp button text

**`src/components/common/PWAInstaller.tsx`** -- All text hardcoded
- Install prompt, iOS modal instructions, buttons

**`src/components/partnership/AgentToolkit.tsx`** -- 3 icon labels hardcoded
- "ملفات احترافية", "دعم تسويقي", "أسئلة شائعة"

**`src/components/partnership/RegistrationForm.tsx`** -- Validation messages + toasts
- zod schema error messages, success/error toast text, file upload description

**`src/pages/EducationalDestinationsPage.tsx`** -- All section text hardcoded
- Hero badge, title, subtitle, section headings, CTA section

**`src/components/educational/UniversityCard.tsx`** -- "التخصصات المتاحة:" label

**`src/components/educational/HeroSection.tsx`** -- Badge, title, subtitle

**`src/components/educational/CTASection.tsx`** -- Title, subtitle, buttons

**`src/components/educational/NoResults.tsx`** -- All text, buttons

**`src/components/educational/SearchAndFilter.tsx`** -- Placeholder, filter label, results count text

**`src/components/educational/MajorCard.tsx`** -- "اقرأ المزيد" text

**`src/components/educational/MajorModal.tsx`** -- All section labels ("الوصف", "مناسب لـ", etc.)

**`src/components/educational/CategoryFilter.tsx`** -- "تصفية حسب الفئة", "جميع التخصصات"

**`src/components/landing/Contact.tsx`** -- Validation messages, toast messages, "جار الإرسال" text

**`src/pages/ResourcesPage.tsx`** -- "افتح الأداة" button text

---

### Group 3: Data files with hardcoded Arabic

**`src/data/majorsData.ts`** -- 1200+ lines, all major names/descriptions in Arabic only
- Category titles, SubMajor fields (nameAR, description, detailedDescription, etc.)
- This is the largest challenge -- need to add `nameEN` and English fields

**`src/data/educationalDestinations.ts`** -- 230+ lines, all in Arabic
- University descriptions, locations, major names, school descriptions

**`src/components/broadcast/data.ts`** -- 120+ lines, all in Arabic
- Video titles, descriptions, category names

---

## Implementation Strategy

### Phase 1: Dynamic direction on all pages
- Import `useDirection()` in every page/component with hardcoded `dir="rtl"`
- Replace with `dir={dir}`
- ~20 files, minimal risk

### Phase 2: Move hardcoded UI text to translation keys
For each component, move hardcoded Arabic text into `t()` calls and add corresponding keys to both `ar/common.json` (or appropriate namespace) and `en/common.json`.

New translation namespaces needed:
- Add keys to `common.json`: PWA, office locations, educational sections
- Add keys to `services.json` (AR + EN): ServicesGrid, ServiceProcess, ConsultationCta, TestimonialSection
- Add keys to `about.json` (AR + EN): WhoWeArePage content
- Add keys to `landing.json` (AR + EN): Locations section
- Add keys to `resources.json` (EN update): "افتح الأداة" button

### Phase 3: Data files with dual language support
For data-heavy files (`majorsData.ts`, `educationalDestinations.ts`, `broadcast/data.ts`):
- Add English fields alongside Arabic (e.g., `nameEN` already exists in SubMajor interface)
- Add `descriptionEN`, `categoryTitleEN` fields
- Components consuming this data will select the right field based on `i18n.language`

---

## Technical Details

### Translation File Updates

**`public/locales/ar/services.json`** -- Add:
- `servicesGrid.*` (section title, subtitle, all 9 service cards, button text)
- `serviceProcess.*` (4 steps, default title/description)
- `consultationCta.*` (form labels, service options, validation, toasts)
- `testimonialSection.*` (section title, subtitle, 3 testimonials)

**`public/locales/en/services.json`** -- Add same keys in English

**`public/locales/ar/common.json`** -- Add:
- `pwa.*` (install prompts, iOS instructions)
- `officeLocations.*` (address, hours, title)
- `locations.*` (4 location cards, section title)
- `educational.*` (hero, CTA, search, filter, modal labels, card labels)

**`public/locales/en/common.json`** -- Add same keys in English

**`public/locales/ar/about.json`** -- Add:
- `whoWeAre.*` (hero, story, values, features, team, CTA)

**`public/locales/en/about.json`** -- Add same keys in English

**`public/locales/ar/partnership.json`** -- Add:
- `agentToolkit.labels.*` (3 icon labels)
- `registrationForm.validation.*` (zod messages)
- `registrationForm.toasts.*` (success/error)

**`public/locales/en/partnership.json`** -- Add same keys in English

### Data File Updates

**`src/data/majorsData.ts`**:
- Add `nameEN` (already in interface but not populated), `descriptionEN`, `detailedDescriptionEN`, `categoryTitleEN` fields
- Components use a helper: `const name = i18n.language === 'en' ? major.nameEN || major.nameAR : major.nameAR`

**`src/data/educationalDestinations.ts`**:
- Add `descriptionEN`, `locationEN`, `majorsEN` fields to universities/schools/services

**`src/components/broadcast/data.ts`**:
- Add `titleEN`, `descriptionEN`, `categoryEN` fields

### Modified Files (Complete List)

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Dynamic dir |
| `src/pages/ContactPage.tsx` | Dynamic dir |
| `src/pages/ServicesPage.tsx` | Dynamic dir |
| `src/pages/LocationsPage.tsx` | Dynamic dir |
| `src/pages/PartnershipPage.tsx` | Dynamic dir |
| `src/pages/BroadcastPage.tsx` | Dynamic dir |
| `src/pages/EducationalProgramsPage.tsx` | Dynamic dir |
| `src/pages/BagrutCalculatorPage.tsx` | Dynamic dir |
| `src/pages/CostCalculatorPage.tsx` | Dynamic dir |
| `src/pages/CurrencyConverterPage.tsx` | Dynamic dir |
| `src/pages/AdminDashboardPage.tsx` | Dynamic dir |
| `src/pages/WhoWeArePage.tsx` | Full i18n migration + dynamic dir |
| `src/pages/EducationalDestinationsPage.tsx` | Full i18n migration |
| `src/pages/ResourcesPage.tsx` | Button text i18n |
| `src/components/services/ServicesGrid.tsx` | Full i18n migration |
| `src/components/services/ServiceProcess.tsx` | Full i18n migration |
| `src/components/services/ConsultationCta.tsx` | Full i18n migration + dynamic dir |
| `src/components/services/TestimonialSection.tsx` | Full i18n migration |
| `src/components/landing/Locations.tsx` | Full i18n migration |
| `src/components/landing/OfficeLocations.tsx` | Full i18n migration |
| `src/components/landing/Contact.tsx` | Validation/toast i18n + dynamic dir |
| `src/components/landing/ContactHero.tsx` | Dynamic dir |
| `src/components/common/PWAInstaller.tsx` | Full i18n migration + dynamic dir |
| `src/components/partnership/AgentToolkit.tsx` | Icon labels i18n |
| `src/components/partnership/RegistrationForm.tsx` | Validation/toast i18n + dynamic dir |
| `src/components/educational/HeroSection.tsx` | Full i18n migration |
| `src/components/educational/CTASection.tsx` | Full i18n migration |
| `src/components/educational/NoResults.tsx` | Full i18n migration |
| `src/components/educational/SearchAndFilter.tsx` | Full i18n migration + dynamic dir |
| `src/components/educational/MajorCard.tsx` | i18n + language-aware field selection |
| `src/components/educational/MajorModal.tsx` | Full i18n migration + dynamic dir |
| `src/components/educational/CategoryFilter.tsx` | Full i18n migration |
| `src/components/educational/UniversityCard.tsx` | Label i18n + language-aware fields |
| `src/components/calculator/CostCalculator.tsx` | Dynamic dir on Selects |
| `src/components/calculator/GpaCalculator.tsx` | Dynamic dir |
| `src/data/majorsData.ts` | Add English fields to all entries |
| `src/data/educationalDestinations.ts` | Add English fields |
| `src/components/broadcast/data.ts` | Add English fields |
| `public/locales/ar/services.json` | Add new keys |
| `public/locales/en/services.json` | Add new keys |
| `public/locales/ar/common.json` | Add new keys |
| `public/locales/en/common.json` | Add new keys |
| `public/locales/ar/about.json` | Add new keys |
| `public/locales/en/about.json` | Add new keys |
| `public/locales/ar/partnership.json` | Add new keys |
| `public/locales/en/partnership.json` | Add new keys |

### What Will NOT Change
- Website design, colors, fonts, layout, or spacing
- Navigation order (logo, menu items, student portal button)
- Component structure or functionality
- RTL behavior when Arabic is selected

### Implementation Note
Due to the very large scope (45+ files), implementation will be done in focused batches to avoid errors. The majorsData.ts file alone has 1200+ lines requiring English translations for every major.
