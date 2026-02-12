

# Two New Features: Revamped Cost Calculator + Lebenslauf Builder

## Feature 1: Revamped Cost Calculator (Language School First Year)

### What Changes

The current calculator uses generic tuition/living data. It will be completely rebuilt to reflect **real, verified pricing from specific language schools** in Germany, letting students pick a school and see accurate first-year costs.

### New Calculator Flow

1. **Select Language School** (dropdown):
   - AlphaAktiv (Heidelberg)
   - F+U Academy (Heidelberg)
   - KAPITO (Munster)
   - GO Academy (Dusseldorf)
   - VICTORIA Academy (Berlin)

2. **Select Course Duration** (slider: 1-52 weeks, default 52)

3. **Select Accommodation Type** (per school -- options vary):
   - Single room (central/non-central)
   - Double room
   - Shared room
   - Host family (half-board / breakfast only)
   - Private apartment

4. **Toggle Options**:
   - Health insurance (short-term 28 EUR/mo vs long-term 125 EUR/mo)
   - Mobile/Internet (O2 unlimited 29.99 EUR/mo)
   - Deutschlandticket (58 EUR/mo)
   - Visa fee (75 EUR one-time)
   - Food budget (slider: 150-250 EUR/mo)

5. **Results Table**: Itemized annual breakdown with monthly average

### Data Structure (new `src/lib/language-school-data.ts`)

Each school object contains:
- Name, city (AR + EN)
- Course pricing tiers (short-term vs long-term per-week rates)
- Registration fee (one-time)
- Accommodation options with weekly rates (short vs long term)
- Accommodation deposit & admin fees

Verified data from the user's message will be encoded exactly as provided.

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/language-school-data.ts` | All verified school pricing data |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/calculator/CostCalculator.tsx` | Complete rewrite: school selector, duration slider, dynamic accommodation options per school, new calculation logic |
| `src/lib/cost-data.ts` | Keep existing (not removed), but no longer used by the main calculator |
| `public/locales/ar/resources.json` | Add new translation keys for schools, accommodation types, toggles |
| `public/locales/en/resources.json` | Same English translations |

### Calculation Logic

```text
Total = Course Cost + Registration Fee
      + (Accommodation weekly rate x weeks)
      + Accommodation deposit + admin fee
      + (Health insurance monthly x months)
      + (Mobile monthly x months)
      + (Transport monthly x months)
      + (Food monthly x months)
      + Visa fee
```

Where `months = weeks / 4.33` (rounded).

---

## Feature 2: Lebenslauf (CV) Builder

### Overview

A new tool page at `/resources/lebenslauf-builder` where students fill in sections of a German-style CV, see a live preview, and download as PDF -- all client-side (no server needed).

### Scope (MVP -- Client-Side Only)

- **3 Templates**: Academic CV, German Standard (reverse-chronological), Europass-compatible
- **Form sections**: Personal info (with optional photo upload), Education (repeatable), Experience (repeatable), Skills/Languages (CEFR levels), Certificates, Volunteer work, References
- **Live preview** panel beside the form (desktop) or below (mobile)
- **PDF export** using browser `window.print()` with `@media print` CSS (no external library needed for MVP -- cleanest output)
- **Bilingual UI** (AR/EN) with RTL support
- **Draft save** to localStorage
- **Validation**: email format, date consistency, required fields

### Templates Design

All templates render as styled HTML with print-optimized CSS:
- **Academic**: Two-column, research/publications prominent
- **German Standard**: Single-column, reverse-chronological, optional photo top-right
- **Europass**: Europass-style layout with skill bars

### User Flow

1. Landing: Choose template + language of CV content (DE/EN/AR)
2. Fill sections via accordion/tab form (click to expand)
3. Live preview updates as you type
4. Add/remove repeatable entries (education, experience)
5. Reorder sections via up/down buttons
6. Click "Download PDF" -- opens print dialog with print-optimized stylesheet

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/LebenslaufBuilderPage.tsx` | Page wrapper with Header/Footer |
| `src/components/lebenslauf/LebenslaufBuilder.tsx` | Main component: form + preview layout |
| `src/components/lebenslauf/CVForm.tsx` | All form sections (personal, education, etc.) |
| `src/components/lebenslauf/CVPreview.tsx` | Live preview renderer |
| `src/components/lebenslauf/templates/AcademicTemplate.tsx` | Academic CV template |
| `src/components/lebenslauf/templates/GermanStandardTemplate.tsx` | German standard template |
| `src/components/lebenslauf/templates/EuropassTemplate.tsx` | Europass template |
| `src/components/lebenslauf/types.ts` | TypeScript interfaces for CV data |
| `src/components/lebenslauf/useLebenslauf.ts` | Hook for state management + localStorage persistence |
| `src/styles/cv-print.css` | Print-only stylesheet for PDF export |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add route `/resources/lebenslauf-builder` |
| `src/pages/ResourcesPage.tsx` | Add 4th tool card for Lebenslauf Builder |
| `public/locales/ar/resources.json` | Add `lebenslaufBuilder` translation keys |
| `public/locales/en/resources.json` | Same in English |

### CV Data Schema (TypeScript)

```typescript
interface CVData {
  template: 'academic' | 'german-standard' | 'europass';
  contentLanguage: 'de' | 'en' | 'ar';
  personal: {
    firstName: string;
    lastName: string;
    photo?: string; // base64
    email: string;
    phone: string;
    address: string;
    birthDate?: string;
    birthPlace?: string;
    nationality?: string;
    linkedin?: string;
    github?: string;
  };
  education: Array<{
    degree: string;
    institution: string;
    city: string;
    country: string;
    from: string;
    to: string;
    current: boolean;
    details: string[];
  }>;
  experience: Array<{...}>;
  publications: Array<{...}>; // academic template
  certificates: Array<{...}>;
  skills: {
    languages: Array<{ name: string; level: string; exam?: string }>;
    technical: string[];
    other: string[];
  };
  volunteer: Array<{...}>;
  references: Array<{...}>;
  showPhoto: boolean;
  showBirthDate: boolean;
}
```

### PDF Strategy

Use `window.print()` with a dedicated print stylesheet that:
- Hides the form panel and site chrome
- Shows only the CV preview at A4 dimensions
- Embeds proper fonts (Inter for Latin, Noto Sans Arabic for AR)
- Sets margins to 15-20mm
- Handles page breaks between sections

This approach produces the highest-fidelity PDF with zero external dependencies.

---

## Implementation Order

1. **Cost Calculator data file** (`language-school-data.ts`)
2. **Cost Calculator component** rewrite
3. **Translation files** update (cost calculator keys)
4. **Lebenslauf types + hook**
5. **CV templates** (3 files)
6. **CV form + preview components**
7. **Lebenslauf page + routing**
8. **Translation files** update (lebenslauf keys)
9. **Print stylesheet**
10. **Resources page** update (add 4th tool card)

---

## What Will NOT Change

- Navigation order, logo, student portal button
- Existing currency converter and bagrut calculator
- RTL/LTR support architecture
- Brand colors and design language
- Any dashboard functionality

