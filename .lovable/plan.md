

# Plan: Add English Language Support (Bilingual AR/EN)

## Overview
Add full English language support to the existing Arabic website. This involves creating all English translation files, moving hardcoded Arabic text to translation keys, adding a language switcher to the header, dynamically switching RTL/LTR direction, and making the AI assistant respond in the selected language.

---

## Scope Assessment

There are two categories of Arabic text in the codebase:

**A. Already using i18n (translation keys):** Header nav, Footer, Hero, WhyChooseUs, Testimonials, StudentGallery, About, Services hero, Contact, Partnership, Resources, Broadcast -- these just need English JSON files created.

**B. Hardcoded Arabic text (not using i18n):** Many components have Arabic strings directly in JSX. These must be moved to translation keys first, then translated.

Key components with hardcoded Arabic:
- `DesktopNav.tsx` -- "المزيد", "اختيار التخصص", "التخصصات", "وجهاتنا التعليمية", dropdown descriptions
- `MobileNav.tsx` -- "التخصصات", "اختيار التخصص", "المزيد", "وجهاتنا التعليمية", "تسجيل الدخول للطلاب"
- `Header.tsx` -- "درب", "تسجيل الدخول للطلاب"
- `BottomNav.tsx` -- all nav item names and aria labels
- `Hero.tsx` -- stats labels ("طالب راض", "شريك تعليمي", "دولة حول العالم")
- `Services.tsx` (landing) -- all 7 service titles
- `AIQuizChat.tsx` -- all UI text, quick questions, category labels
- `AIChatPopup.tsx` -- title, description, placeholder, offline text
- `AIAdvisorPage.tsx` -- all UI text, categories, quick questions
- `ChatWidget.tsx` -- aria labels
- `StudentAuthPage.tsx` -- all form labels, error messages, toasts
- `App.tsx` -- NetflixLoader text ("درب", "رفيقك الدراسي العالمي")
- `useAIChat.ts` -- QUICK_QUESTIONS array, offline messages
- Various other components

---

## 1. i18n Configuration Update

**File**: `src/i18n.ts`
- Add language detection from `localStorage` with fallback to `'ar'`
- Keep `fallbackLng: 'ar'`
- Add `supportedLngs: ['ar', 'en']`

```typescript
i18n.init({
  lng: localStorage.getItem('i18n_lang') || 'ar',
  fallbackLng: 'ar',
  supportedLngs: ['ar', 'en'],
  // ... rest stays the same
});
```

---

## 2. Language Switcher Component

**New file**: `src/components/common/LanguageSwitcher.tsx`

A small toggle button showing "EN" when in Arabic mode and "عربي" when in English mode. On click:
1. Changes i18n language
2. Saves to `localStorage`
3. Updates `document.documentElement.dir` to `rtl` or `ltr`
4. Updates `document.documentElement.lang` to `ar` or `en`

Placement:
- **Header.tsx**: Add between the desktop nav and "Student Login" button (hidden on mobile)
- **MobileNav.tsx**: Add at the top of the mobile menu sheet

---

## 3. Dynamic RTL/LTR Switching

**File**: `src/App.tsx`
- Change hardcoded `dir="rtl"` and `lang="ar"` to be reactive based on `i18n.language`
- Subscribe to `i18n.on('languageChanged')` to update `document.documentElement.dir` and `lang`
- Move the NetflixLoader text to translation keys

---

## 4. English Translation Files

Create the full `public/locales/en/` directory with 9 JSON files:

| File | Content |
|------|---------|
| `public/locales/en/common.json` | Nav items, footer, CTA, 404 page |
| `public/locales/en/landing.json` | Hero, WhyChooseUs, Testimonials, StudentGallery |
| `public/locales/en/about.json` | About intro, CEO message, key features, team |
| `public/locales/en/services.json` | Services hero |
| `public/locales/en/contact.json` | Contact hero, form labels, toast messages |
| `public/locales/en/partnership.json` | Full partnership page (hero, FAQ, how it works, trust, forms) |
| `public/locales/en/resources.json` | All calculator labels, currency comparator, GPA calculator, guides |
| `public/locales/en/broadcast.json` | Broadcast page labels |
| `public/locales/en/partners.json` | Partners page (hero, tabs, stats, CTA) |

All translations will maintain accuracy and cultural sensitivity for Arab 48 students reading in English.

---

## 5. Move Hardcoded Arabic to Translation Keys

### Add new keys to `common.json` (both AR and EN):

```json
{
  "nav": {
    "more": "المزيد / More",
    "majors": "التخصصات / Majors",
    "majorQuiz": "اختيار التخصص / Find Your Major",
    "educationalDestinations": "وجهاتنا التعليمية / Educational Destinations",
    "educationalDestinationsDesc": "... / ...",
    "broadcastDesc": "... / ...",
    "studentLogin": "تسجيل الدخول للطلاب / Student Login"
  },
  "loader": {
    "brand": "درب / Darb",
    "tagline": "رفيقك الدراسي العالمي / Your Global Study Companion"
  },
  "bottomNav": { ... },
  "chat": { ... },
  "auth": { ... }
}
```

### Components to update (move hardcoded text to `t()` calls):

| Component | Hardcoded strings to move |
|-----------|--------------------------|
| `Header.tsx` | Brand name "درب", login button text |
| `DesktopNav.tsx` | "المزيد", "اختيار التخصص", "التخصصات", dropdown descriptions |
| `MobileNav.tsx` | Same as above + "تسجيل الدخول للطلاب" |
| `BottomNav.tsx` | All 4 nav items and aria labels |
| `Hero.tsx` | Stats labels |
| `Services.tsx` (landing) | All 7 service titles |
| `App.tsx` | NetflixLoader strings |
| `AIQuizChat.tsx` | Title, description, categories, quick questions, buttons, placeholder |
| `AIChatPopup.tsx` | Title, description, placeholder, offline text, empty state |
| `AIAdvisorPage.tsx` | Title, description, categories, buttons, placeholder |
| `ChatWidget.tsx` | Aria labels |
| `useAIChat.ts` | QUICK_QUESTIONS, offline messages |
| `StudentAuthPage.tsx` | All form labels, placeholders, error messages, toast messages |

---

## 6. AI Language Detection

**File**: `supabase/functions/ai-chat/index.ts`
- Accept a `language` parameter from the frontend (`'ar'` or `'en'`)
- Add English versions of system prompts (SYSTEM_PROMPT_EN and QUIZ_SYSTEM_PROMPT_EN)
- Select prompt based on the `language` parameter
- English prompts will instruct the AI to respond in English while maintaining the same knowledge base

**File**: `src/hooks/useAIChat.ts`
- Pass `i18n.language` as `language` parameter in the request body

**File**: `src/components/chat/AIChatPopup.tsx`, `AIQuizChat.tsx`, `AIAdvisorPage.tsx`
- Quick questions will use translated arrays from translation files instead of hardcoded arrays

---

## 7. Direction-Aware Layout Adjustments

Components with hardcoded `dir="rtl"` or RTL-specific classes (like `text-right`, `mr-6`) need to be made direction-aware:

- `Header.tsx`: `dir="rtl"` -> dynamic based on language
- `DesktopNav.tsx`: `dir="rtl"` -> dynamic
- `MobileNav.tsx`: `side="right"`, `text-right` -> conditional
- `BottomNav.tsx`: `dir="rtl"` -> dynamic
- `App.tsx`: `dir="rtl"` -> dynamic
- `AIChatPopup.tsx`: `dir="rtl"` -> dynamic
- `AIQuizChat.tsx`: `dir="rtl"` -> dynamic
- `AIAdvisorPage.tsx`: `dir="rtl"` -> dynamic

Approach: Use a small utility or hook (`useDirection`) that returns `'rtl'` or `'ltr'` and corresponding text alignment class based on `i18n.language`.

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/components/common/LanguageSwitcher.tsx` | Language toggle component |
| `public/locales/en/common.json` | English common translations |
| `public/locales/en/landing.json` | English landing page translations |
| `public/locales/en/about.json` | English about page translations |
| `public/locales/en/services.json` | English services translations |
| `public/locales/en/contact.json` | English contact translations |
| `public/locales/en/partnership.json` | English partnership translations |
| `public/locales/en/resources.json` | English resources translations |
| `public/locales/en/broadcast.json` | English broadcast translations |
| `public/locales/en/partners.json` | English partners translations |

### Modified Files

| File | Changes |
|------|---------|
| `src/i18n.ts` | Add localStorage persistence, supportedLngs |
| `src/App.tsx` | Dynamic dir/lang, move loader text to i18n |
| `src/components/landing/Header.tsx` | Add LanguageSwitcher, dynamic dir, translate hardcoded text |
| `src/components/landing/DesktopNav.tsx` | Move all hardcoded Arabic to t() calls, dynamic dir |
| `src/components/landing/MobileNav.tsx` | Move hardcoded text to t(), dynamic dir/side |
| `src/components/common/BottomNav.tsx` | Move nav items to t() calls, dynamic dir |
| `src/components/landing/Hero.tsx` | Move stats labels to t() |
| `src/components/landing/Services.tsx` | Move service titles to t() |
| `src/hooks/useAIChat.ts` | Accept language param, translate quick questions and offline messages |
| `src/components/quiz/AIQuizChat.tsx` | Move all text to t(), pass language to AI |
| `src/components/chat/AIChatPopup.tsx` | Move all text to t(), dynamic dir |
| `src/pages/AIAdvisorPage.tsx` | Move all text to t() |
| `src/components/chat/ChatWidget.tsx` | Translate aria labels |
| `src/pages/StudentAuthPage.tsx` | Move all form text and error messages to t() |
| `supabase/functions/ai-chat/index.ts` | Add English system prompts, language parameter |
| `public/locales/ar/common.json` | Add new keys for previously hardcoded text |

### What Will NOT Change
- Website design, colors, fonts, layout, or spacing
- Navigation order (logo, menu items, student portal button)
- Component structure or functionality
- PWA behavior
- Authentication or security layers

### Implementation Note
Due to the large number of files involved (30+), this will be implemented in focused batches:
1. Infrastructure (i18n config, LanguageSwitcher, App.tsx direction logic)
2. English translation files (all 9 JSON files)
3. Component updates (move hardcoded text to i18n keys)
4. AI integration (edge function English prompts + language passing)

