

# Fix Majors Cards + Broadcast Translation + Full Site Translation Audit

## Problem

Two categories of untranslated content were found:

### 1. Majors Data (Critical)
The entire `majorsData.ts` file (1211 lines, ~40+ majors) contains **Arabic-only content**. The `SubMajor` interface only has `nameAR` and `description` (Arabic) with no English equivalents. When the site is switched to English, all major cards and modal details still show Arabic text for:
- Major names (`nameAR`)
- Short descriptions (`description`)
- Detailed descriptions (`detailedDescription`)
- Duration, career prospects, requirements, suitableFor, requiredBackground, languageRequirements, careerOpportunities, arab48Notes
- Category titles (`MajorCategory.title`)

Components affected: `MajorCard.tsx`, `MajorModal.tsx`, `SearchAndFilter.tsx`, `CategoryFilter.tsx`

### 2. Broadcast Page (Moderate)
Multiple broadcast components have hardcoded Arabic strings:
- **BroadcastVideoCard.tsx**: "مشاركة" (Share), "تم نسخ الرابط!" (Link copied), toast messages, date locale always Arabic
- **VideoCategories.tsx**: Category names hardcoded ("نصائح الدراسة", "تجارب الطلبة", etc.), "الكل" (All) button
- **HeroVideo.tsx**: "مشاهدة على يوتيوب" / "مشاهدة الفيديو" buttons
- **SubmitVideo.tsx**: ~15 hardcoded Arabic strings (form labels, placeholders, toast messages, button text)
- **data.ts**: All video titles, descriptions, country names are Arabic-only
- **BroadcastCategory type**: Categories are Arabic string literals

---

## Implementation Plan

### Phase 1: Add bilingual fields to majorsData

**Update `SubMajor` interface** to add English fields:
```typescript
export interface SubMajor {
  id: string;
  nameAR: string;
  nameEN: string;        // NEW
  nameDE?: string;
  description: string;   // Arabic description
  descriptionEN: string;  // NEW
  detailedDescription?: string;
  detailedDescriptionEN?: string;  // NEW
  duration?: string;
  durationEN?: string;    // NEW
  // Same pattern for all text fields...
}
```

**Update `MajorCategory` interface:**
```typescript
export interface MajorCategory {
  id: string;
  title: string;      // Arabic
  titleEN: string;     // NEW
  subMajors: SubMajor[];
}
```

**Add English content for all ~40 majors** in `majorsData.ts`. Each major needs English translations for: nameEN, descriptionEN, detailedDescriptionEN, durationEN, careerProspectsEN, requirementsEN, suitableForEN, requiredBackgroundEN, languageRequirementsEN, careerOpportunitiesEN, arab48NotesEN.

### Phase 2: Create a bilingual data helper

**Create `src/utils/majorLocale.ts`** -- a helper that picks the right field based on current language:
```typescript
export const getLocalizedMajor = (major: SubMajor, lang: string) => ({
  ...major,
  name: lang === 'en' ? major.nameEN : major.nameAR,
  desc: lang === 'en' ? major.descriptionEN : major.description,
  detailedDesc: lang === 'en' ? (major.detailedDescriptionEN || major.descriptionEN) : (major.detailedDescription || major.description),
  // ... same for all fields
});
```

### Phase 3: Update Major components

**MajorCard.tsx** -- Use localized fields instead of `major.nameAR` / `major.description`:
- Import `useTranslation` to get current language
- Display `name` (localized) instead of `nameAR`
- Display `desc` (localized) instead of `description`
- Pass localized `categoryTitle` / `categoryTitleEN`

**MajorModal.tsx** -- Same approach for all modal sections (description, suitableFor, requiredBackground, languageRequirements, careerOpportunities, requirements, arab48Notes, duration)

**SearchAndFilter.tsx** -- Category filter buttons use localized titles; search works on both language fields

**EducationalProgramsPage.tsx** -- When flattening majors, include localized category title

### Phase 4: Broadcast page translation

**Add keys to `public/locales/en/broadcast.json` and `public/locales/ar/broadcast.json`:**
```json
{
  "broadcastPage": {
    "share": "Share",
    "linkCopied": "Link copied!",
    "linkCopiedDesc": "You can now share the video.",
    "watchOnYoutube": "Watch on YouTube",
    "watchVideo": "Watch Video",
    "allCategories": "All",
    "cat_studyTips": "Study Tips",
    "cat_studentExperiences": "Student Experiences",
    "cat_visaProcedures": "Visa Procedures",
    "cat_workshops": "Workshops & Guidance",
    "submitTitle": "Have a special moment to share?",
    "submitDesc": "Share your success story to inspire others",
    "sendWhatsapp": "Send via WhatsApp",
    "or": "or",
    "nameLabel": "Name",
    "namePlaceholder": "Your full name",
    "universityLabel": "University",
    "universityPlaceholder": "Your current university",
    "videoLinkLabel": "Video Link (YouTube, ...)",
    "videoLinkPlaceholder": "https://youtube.com/...",
    "uploadLabel": "Or upload a video file",
    "uploadLimit": "Max size: 50MB (currently unavailable)",
    "submitting": "Sending... ⏳",
    "submitButton": "Submit Video",
    "submitSuccess": "Video sent successfully! ✅",
    "submitSuccessDesc": "Thank you for sharing. We'll review it soon.",
    "submitError": "An error occurred ❌",
    "missingFields": "Missing data",
    "missingFieldsDesc": "Please fill in name, university, and video link.",
    "copyTooltip": "📎 Copy link to share"
  }
}
```

**Update components:**
- `BroadcastVideoCard.tsx` -- Replace 4 hardcoded strings with `t()` calls; use locale-aware date formatting
- `VideoCategories.tsx` -- Map category IDs to translation keys instead of Arabic literals; change `BroadcastCategory` to use IDs
- `HeroVideo.tsx` -- Replace 2 button labels with `t()` calls
- `SubmitVideo.tsx` -- Replace ~15 hardcoded strings with `t()` calls

**Update `data.ts`:**
- Add English fields to `BroadcastPost` (titleEN, descriptionEN, countryEN)
- Change `BroadcastCategory` from Arabic literals to English IDs: `'study-tips' | 'student-experiences' | 'visa-procedures' | 'workshops'`

### Phase 5: Broadcast data bilingual content

Add English titles and descriptions for all 10 broadcast videos in `data.ts`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/data/majorsData.ts` | Add EN fields to interfaces + English content for all ~40 majors |
| `src/utils/majorLocale.ts` | NEW -- helper to pick localized fields |
| `src/components/educational/MajorCard.tsx` | Use localized name/description |
| `src/components/educational/MajorModal.tsx` | Use localized fields for all sections |
| `src/components/educational/SearchAndFilter.tsx` | Localized category titles |
| `src/components/educational/CategoryFilter.tsx` | Localized category titles |
| `src/pages/EducationalProgramsPage.tsx` | Pass localized category title when flattening |
| `public/locales/en/broadcast.json` | Add ~25 new translation keys |
| `public/locales/ar/broadcast.json` | Add ~25 matching Arabic keys |
| `src/components/broadcast/data.ts` | Add EN fields, change category type to IDs |
| `src/components/broadcast/BroadcastVideoCard.tsx` | i18n for share/toast + locale-aware dates |
| `src/components/broadcast/VideoCategories.tsx` | i18n for category names + "All" button |
| `src/components/broadcast/HeroVideo.tsx` | i18n for CTA button text |
| `src/components/broadcast/SubmitVideo.tsx` | i18n for all form labels/toasts |
| `src/pages/BroadcastPage.tsx` | Minor -- pass language for data localization |

**Estimated: 15 files, ~200+ strings**

---

## What Will NOT Change
- Navigation order, logo, student portal button position
- Brand colors and design language
- Existing working translations on public pages
- Video URLs, YouTube IDs, poster images
- Any database or backend logic
