

# Plan: Germany-Only AI-Powered Guidance Platform

## Overview
Seven major changes: replace the static quiz with an AI-powered conversational advisor, update subject pages for accuracy, update social media links, separate resource tools into dedicated pages, improve the Bagrut calculator, clean up educational destinations to Germany-only, and enhance the AI system prompt with subject/university knowledge.

---

## 1. Replace Quiz with AI-Based Major Recommendation

### What changes
- **Remove**: `src/components/quiz/MajorMatchingQuiz.tsx` (static quiz component)
- **Repurpose**: `src/pages/QuizPage.tsx` becomes a wrapper for a new AI-driven conversational quiz
- **Create**: `src/components/quiz/AIQuizChat.tsx` -- a full-page AI chat styled like the existing `AIAdvisorPage` but with a specialized system prompt focused on major recommendation

### How it works
- The AI asks adaptive questions one by one in a conversational style (education background, interests, strengths, German level, career goals)
- Based on the conversation, the AI recommends 2-3 suitable majors with explanations
- Each recommendation includes a link to `/educational-programs` filtered by that major
- Uses the same `useAIChat` hook and streaming infrastructure
- A new edge function `ai-quiz` (or a mode flag on `ai-chat`) with a specialized system prompt for major matching

### AI Quiz System Prompt (key points)
- Act as an academic advisor for Arab 48 students
- Ask 5-7 adaptive questions about: Bagrut subjects and grades, personal interests, strengths, German language level, career aspirations
- After gathering enough info, recommend 2-3 majors from the actual majors database
- Explain why each fits the student
- Provide links to the relevant subject pages

### Technical approach
- Add a `mode` parameter to the existing `ai-chat` edge function (e.g., `mode: "quiz"`) that switches to the quiz-specific system prompt
- Reuse `useAIChat` with a `mode` prop
- The quiz page has a welcome screen with an explanation, then transitions into the chat

---

## 2. Subject Pages -- Accuracy Update

### What changes
- **Update**: `src/data/majorsData.ts` -- enhance every `SubMajor` entry with additional fields

### New fields per subject (added to the `SubMajor` interface)
```
suitableFor: string       // Who this subject is suitable for
requiredBackground: string // Required academic background  
languageRequirements: string // German/English level needed
careerOpportunities: string  // Career paths in Germany specifically
arab48Notes: string        // Special notes for Arab 48 students
```

### Content updates
- Remove references to Romania/Jordan universities in quiz results
- Ensure all career prospects mention Germany-specific opportunities
- Add language requirements (e.g., "B2 German for most programs, C1 for medicine")
- Add specific notes for Arab 48 students (e.g., Bagrut equivalency, Studienkolleg requirements)
- All information must be Germany-focused

### Subject modal update
- Update `MajorModal.tsx` to display the new fields in organized sections

---

## 3. Update Social Media Links

### Files to update

| File | Current Link | New Link |
|------|-------------|----------|
| `src/components/landing/Footer.tsx` | `instagram.com/darb_studyinternational` | `https://www.instagram.com/darb_studyingermany/` |
| `src/components/landing/Footer.tsx` | `tiktok.com/@darb_studyinternational` | `https://www.tiktok.com/@darb_studyingrmany` |
| `src/components/landing/Footer.tsx` | `facebook.com/DARB_STUDYINGERMANY` | `https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/` |
| `src/components/chat/ChatPopup.tsx` | `wa.me/972524061225` | `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1` |
| `src/components/landing/OfficeLocations.tsx` | `wa.me/972524061225` | `https://api.whatsapp.com/message/IVC4VCAEJ6TBD1` |

Also add WhatsApp link to Footer if not already present.

---

## 4. Resources -- Separate Tools into Dedicated Sections

### What changes
- **Refactor**: `src/pages/ResourcesPage.tsx` -- instead of stacking all tools in one long page, create a hub with navigation cards
- **Create**: Individual route pages for each tool:
  - `/resources/cost-calculator` -- `src/pages/CostCalculatorPage.tsx`
  - `/resources/currency-converter` -- `src/pages/CurrencyConverterPage.tsx`
  - `/resources/bagrut-calculator` -- `src/pages/BagrutCalculatorPage.tsx`
- **Update**: `src/App.tsx` -- add the new routes
- **Keep**: The main `/resources` page as a hub showing cards that link to each tool
- Reuse existing components (`CostCalculator`, `CurrencyConverter`, `GpaCalculator`) -- just wrap each in its own page with Header/Footer

### Resources hub layout
- Grid of cards, each with icon, title, description, and a "Open Tool" button
- Guides section remains on the main resources page
- Same design language, no visual changes

---

## 5. Bagrut Calculator Improvements

### Current issues
- The formula `germanGrade = 1 + 3 * ((100 - average) / 30)` is a simplified linear conversion
- The correct Bavarian formula (modified Bavarian formula) is: `germanGrade = 1 + 3 * ((Nmax - Nd) / (Nmax - Nmin))`
  - Where Nmax = best possible grade (100), Nmin = minimum passing grade (56 for Bagrut), Nd = student's average

### What changes
- **Update**: `src/components/calculator/GpaCalculator.tsx`
  - Fix the formula to use the correct Bavarian method: `1 + 3 * ((100 - average) / (100 - 56))`
  - Add input validation messages in Arabic (e.g., "Please enter a grade between 0-100")
  - Add a brief explanation of the Bavarian formula below the results
  - Add unit validation (units must be between 1-5)
  - Show a warning if the average is below 56 (minimum passing grade)
  - Add tooltips explaining what "units" (yehidot) means for each subject

---

## 6. Educational Destinations -- Germany Only

### What changes
- **Already mostly done**: `educationalDestinations.ts` only has Germany data
- **Clean up**: `CountrySelector.tsx` -- since there's only Germany, either hide the selector or show it as a single selected tab
- **Clean up**: `GuidesReferences.tsx` -- remove Romania and Jordan tabs from the country filter
- **Clean up**: `src/components/partners/data/universities.ts` -- already has empty Romania/Jordan arrays, can remove those exports
- **Update**: `EducationalDestinationsPage.tsx` -- remove the country selector since only Germany exists; show universities directly

---

## 7. AI Integration -- Enhanced Knowledge Base

### What changes
- **Update**: `supabase/functions/ai-chat/index.ts` -- enhance the system prompt with:
  - A summary of all available majors from `majorsData.ts`
  - A list of partner universities with their strong fields
  - Updated information about Bagrut equivalency and Studienkolleg
  - Links to relevant pages on the platform (e.g., `/educational-programs`, `/resources/bagrut-calculator`)

### System prompt additions
- List of all subject categories and their majors (from majorsData)
- Top German universities with their specialties (from educationalDestinations)
- Language school partners
- Instructions to always reference platform pages when recommending

---

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/components/quiz/AIQuizChat.tsx` | AI-powered conversational quiz component |
| `src/pages/CostCalculatorPage.tsx` | Dedicated cost calculator page |
| `src/pages/CurrencyConverterPage.tsx` | Dedicated currency converter page |
| `src/pages/BagrutCalculatorPage.tsx` | Dedicated Bagrut calculator page |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/QuizPage.tsx` | Replace static quiz with AI quiz chat |
| `src/data/majorsData.ts` | Add new fields (suitableFor, requiredBackground, languageRequirements, careerOpportunities, arab48Notes) to SubMajor interface and all entries |
| `src/components/educational/MajorModal.tsx` | Display new subject fields |
| `src/components/landing/Footer.tsx` | Update all social media links |
| `src/components/chat/ChatPopup.tsx` | Update WhatsApp link |
| `src/components/landing/OfficeLocations.tsx` | Update WhatsApp link |
| `src/pages/ResourcesPage.tsx` | Convert to hub page with navigation cards |
| `src/App.tsx` | Add new tool routes |
| `src/components/calculator/GpaCalculator.tsx` | Fix Bavarian formula, add validation, tooltips |
| `src/pages/EducationalDestinationsPage.tsx` | Remove country selector, Germany-only layout |
| `src/components/educational/CountrySelector.tsx` | Hide or simplify for single country |
| `src/components/resources/GuidesReferences.tsx` | Remove Romania/Jordan tabs |
| `supabase/functions/ai-chat/index.ts` | Enhanced system prompt with subject and university knowledge, quiz mode support |
| `supabase/config.toml` | No changes needed (ai-chat already configured) |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/quiz/MajorMatchingQuiz.tsx` | Replaced by AI-powered quiz |

### What Will NOT Change
- Website design, colors, fonts, layout, or spacing
- Navigation order (logo, menu items, student portal button)
- Existing component styling
- Authentication or security layers
- RTL direction behavior

