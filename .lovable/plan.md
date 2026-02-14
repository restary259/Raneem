

## Global Hero and Navigation Visual Consistency Fix

This plan creates a unified `PageHero` component and standardizes all hero sections across the platform for consistent spacing, contrast, and brand alignment.

---

### Audit Summary: Current Hero Inconsistencies

| Page | Component | Background | Text Color | Top Padding | Issues |
|------|-----------|------------|------------|-------------|--------|
| Home | `Hero.tsx` | Video + primary/85 overlay | White | Full viewport | OK (unique layout) |
| Services | `ServicesHero.tsx` | `from-primary to-background` gradient | `primary-foreground` | `py-12 sm:py-20 md:py-32` | Gradient fades to light bg, text stays light = poor contrast at bottom |
| Contact | `ContactHero.tsx` | `from-primary/90 to-background` | `primary-foreground` | `py-12 sm:py-20 md:py-32` | Same fade-to-light contrast issue |
| About (old) | `AboutIntro.tsx` | `bg-secondary` (light gray) | `text-primary` (dark) | `py-12 md:py-24` | OK contrast but different style |
| Who We Are | Inline in page | Image + `bg-black/60` | White | `py-24 md:py-36` | Good contrast, different spacing |
| Partnership | `PartnershipHero.tsx` | Image + `bg-black/60` | White | `py-20 md:py-40` | Good contrast, different spacing |
| Majors | `HeroSection.tsx` | `from-orange-50 to-background` | `text-foreground` (dark) | `py-8 md:py-12` | Very small padding, feels cramped |
| Housing | `HousingHero.tsx` | `from-orange-500 to-yellow-500` | White | `py-16` | OK but unique style |
| Partners | Inline in page | `from-primary/5 to-background` | `text-foreground` | `py-8 sm:py-12 md:py-20` | Very light bg, adequate contrast |
| Resources | Inline in page | `from-primary/10 via-accent/5` | `text-foreground` | `py-12 md:py-20` | OK |
| Broadcast | `HeroVideo.tsx` | Video + gradient overlay | White | Full height `60-70vh` | OK (unique layout) |
| Apply | Inline | None (plain bg) | Standard | `py-6 md:py-10` | Minimal, OK for form page |

---

### Phase 1: Create Reusable `PageHero` Component

Create `src/components/common/PageHero.tsx` with three background variants:

- **`gradient`** (default): Uses the brand primary-to-primary/80 gradient with guaranteed dark background and white text
- **`light`**: Light neutral background (`bg-secondary`) with dark text
- **`image`**: Background image with dark overlay ensuring white text readability

Props:
- `title: string`
- `subtitle?: string`
- `variant?: 'gradient' | 'light' | 'image'`
- `imageUrl?: string` (for image variant)
- `badge?: string` (optional top badge)
- `children?: ReactNode` (for custom content like buttons or selects)

Standardized spacing: `pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-28 md:pb-20` -- ensures consistent top padding that accounts for the sticky 56px/64px navbar without content touching it.

Contrast rules enforced in the component:
- `gradient` and `image` variants: always use `text-white` with dark overlay
- `light` variant: always use `text-foreground` on light bg
- No semi-transparent text on gradient edges

### Phase 2: Replace Individual Hero Components

**Files to modify** (replace custom hero with `PageHero`):

1. **`src/components/services/ServicesHero.tsx`** -- Replace gradient-to-background (contrast issue) with `PageHero variant="gradient"`
2. **`src/components/landing/ContactHero.tsx`** -- Replace gradient-to-background with `PageHero variant="gradient"`
3. **`src/components/about/AboutIntro.tsx`** -- Replace with `PageHero variant="light"`
4. **`src/components/educational/HeroSection.tsx`** -- Replace with `PageHero variant="light"` with badge
5. **`src/pages/WhoWeArePage.tsx`** (inline hero) -- Replace with `PageHero variant="image"`
6. **`src/pages/PartnersPage.tsx`** (inline hero) -- Replace with `PageHero variant="light"` with badge
7. **`src/pages/ResourcesPage.tsx`** (inline hero) -- Replace with `PageHero variant="light"`
8. **`src/components/partnership/PartnershipHero.tsx`** -- Replace with `PageHero variant="image"` with CTA button as children

**NOT changed** (unique layouts that require custom structure):
- `Hero.tsx` (landing page) -- Full viewport video hero, unique
- `HeroVideo.tsx` (broadcast) -- Full-height video player, unique
- `HousingHero.tsx` -- Has interactive city selector, keep as custom but fix spacing
- `ApplyPage.tsx` -- Minimal form page, not a traditional hero

### Phase 3: Fix Navbar Contrast

The navbar is already solid white with dark text (`bg-white border-b`), which is correct. No transparent-over-hero mode needed since the header is sticky and always solid.

Verify:
- All nav link text uses `text-gray-700` (already does)
- Hover states use `text-orange-500` (already does)
- No opacity on nav links (confirmed clean)

### Phase 4: Fix Housing Hero Spacing

Update `HousingHero.tsx` to use consistent top padding matching the new standard: `pt-16 pb-12 sm:pt-20 sm:pb-16` instead of the current flat `py-16`.

### Phase 5: Mobile Validation

The `PageHero` component will include:
- Responsive font sizes via Tailwind (`text-2xl sm:text-3xl md:text-4xl lg:text-5xl`)
- Container padding (`px-4 sm:px-6`)
- Max-width on subtitle text (`max-w-3xl mx-auto`)
- No horizontal overflow

---

### Technical File Summary

| File | Action |
|------|--------|
| `src/components/common/PageHero.tsx` | **CREATE** -- Reusable hero with 3 variants |
| `src/components/services/ServicesHero.tsx` | Replace with PageHero (fixes contrast) |
| `src/components/landing/ContactHero.tsx` | Replace with PageHero (fixes contrast) |
| `src/components/about/AboutIntro.tsx` | Replace with PageHero variant="light" |
| `src/components/educational/HeroSection.tsx` | Replace with PageHero + badge (fixes cramped spacing) |
| `src/components/partnership/PartnershipHero.tsx` | Replace with PageHero variant="image" + CTA children |
| `src/pages/WhoWeArePage.tsx` | Replace inline hero with PageHero variant="image" |
| `src/pages/PartnersPage.tsx` | Replace inline hero with PageHero variant="light" |
| `src/pages/ResourcesPage.tsx` | Replace inline hero with PageHero variant="light" |
| `src/components/housing/HousingHero.tsx` | Fix top padding consistency |

### Implementation Order

1. Create `PageHero` component
2. Replace all simple hero sections (Services, Contact, About, Educational, Resources, Partners)
3. Replace image-based heroes (Partnership, WhoWeAre)
4. Fix Housing hero spacing
5. Visual verification across all pages

