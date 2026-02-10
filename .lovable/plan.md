

# Plan: Animation & Card Enhancement

## Overview
Enhance the visual polish of all cards and interactive elements across the website with smoother animations, better hover effects, and scroll-triggered entrance animations -- without changing any design, layout, colors, fonts, or spacing.

---

## 1. Global Animation Infrastructure

### `tailwind.config.ts` -- Add new keyframes & animations:
- `fade-in-up`: fade + translate up (for scroll-triggered card entrances)
- `fade-in-left` / `fade-in-right`: for staggered grid items
- `shimmer`: subtle shine effect for card borders on hover
- `float`: gentle floating effect for icons

### `src/styles/animations.css` -- Add new utility classes:
- `.card-hover`: unified hover effect (shadow lift + subtle scale + border glow transition)
- `.animate-on-scroll`: base class for scroll-triggered animations (starts invisible)
- `.btn-press`: active state scale-down for buttons (press feedback)
- `.focus-ring`: enhanced focus ring animation for accessibility

---

## 2. Reusable Scroll Animation Hook

### New file: `src/hooks/useScrollAnimation.ts`
A lightweight hook wrapping `react-intersection-observer` to apply staggered fade-in animations to lists of cards:
- Takes a `delay` multiplier for stagger
- Returns `ref` and `className` with the appropriate animation state
- Uses `triggerOnce: true` for performance

---

## 3. Card Component Enhancement (`src/components/ui/card.tsx`)

Add a default `transition-all duration-300` to the base Card component so all cards benefit from smooth transitions. This is a minimal change -- just adding transition classes to the default className string.

---

## 4. Card-Specific Enhancements

### Landing Page Cards

**`Services.tsx`** (landing):
- Add `useInView` for staggered entrance with `animation-delay` per card
- Enhance hover: `hover:shadow-xl hover:-translate-y-1 hover:border-accent/30`

**`WhyChooseUs.tsx`**:
- Already has `animate-fade-in` -- add `hover:shadow-2xl` and smooth border transition on hover
- Add `hover:border-accent/20` for subtle accent border glow

**`Testimonials.tsx`**:
- Add staggered scroll entrance animation per testimonial card
- Add `hover:shadow-lg hover:-translate-y-1` with smooth transition

### Services Page Cards

**`ServicesGrid.tsx`**:
- Add staggered scroll entrance (cards fade in sequentially as user scrolls)
- Icon container: add `group-hover:scale-110 group-hover:shadow-lg` transition
- Button: add `active:scale-95` press feedback

### Educational Cards

**`MajorCard.tsx`**:
- Refine hover: replace `hover:scale-105` (too aggressive) with `hover:scale-[1.02] hover:shadow-xl hover:border-accent/30`
- Add staggered entrance animation

### Resources Page Cards

**`ResourcesPage.tsx`**:
- Add staggered entrance for tool cards and guide cards
- Icon: add `group-hover:scale-110 group-hover:rotate-3` micro-animation

### Partner Cards

**`partners/UniversityCard.tsx`**:
- Already has hover effects -- enhance with `hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]` for deeper shadow
- Logo: add `group-hover:scale-105` subtle zoom

**`partners/ServiceCard.tsx`**:
- Already good -- add entrance animation

**`partners/InteractiveCard.tsx`**:
- Add smooth `transition-shadow` and `hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)]`

### Partnership Page Cards

**`NewHowItWorks.tsx`** timeline cards:
- Add `hover:shadow-md hover:border-accent/20` to timeline step cards
- Circle icons: add `hover:scale-110` transition

**`TrustSection.tsx`**:
- Add staggered entrance and `hover:shadow-lg hover:-translate-y-1` to trust pillar cards

**`WhyJoinUs.tsx`**:
- Add staggered scroll entrance per benefit card

### Resource Cards

**`ResourceCard.tsx`**:
- Add `hover:border-accent/20` and entrance animation

---

## 5. Button Micro-Interactions

### `src/components/ui/button.tsx`
Add `active:scale-[0.97]` to the base button CVA class for press feedback on all buttons. This is a single-line addition to the base string. Also add `transition-transform` to ensure smooth animation.

---

## 6. Section Entrance Animations

### Components getting scroll-triggered section titles:
- `Hero.tsx`: hero text already has `animate-fade-in` -- no change needed
- `StudentJourney.tsx`: Add `useInView` to each step for staggered entrance (steps appear one by one as user scrolls)
- `Contact.tsx`: Add fade-in for the contact form card
- `Footer.tsx`: Add subtle fade-in for footer content

---

## 7. Chat/AI Interaction Animations

### `AIQuizChat.tsx` and `AIChatPopup.tsx`:
- Message bubbles: add `animate-fade-in` with short duration for new messages appearing
- Loading indicator: already has `animate-spin` -- no change needed
- Quick question buttons: add `hover:scale-[1.02] active:scale-[0.98]` feedback

---

## Technical Details

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useScrollAnimation.ts` | Reusable hook for staggered scroll-triggered animations |

### Modified Files

| File | Changes |
|------|---------|
| `tailwind.config.ts` | Add `fade-in-up`, `fade-in-left`, `fade-in-right` keyframes and animations |
| `src/styles/animations.css` | Add `.card-hover`, `.btn-press`, `.animate-on-scroll` utilities |
| `src/components/ui/card.tsx` | Add `transition-all duration-300` to base Card class |
| `src/components/ui/button.tsx` | Add `active:scale-[0.97] transition-transform` to base class |
| `src/components/landing/Services.tsx` | Staggered entrance + enhanced hover |
| `src/components/landing/WhyChooseUs.tsx` | Enhanced hover border glow |
| `src/components/landing/Testimonials.tsx` | Staggered entrance + hover lift |
| `src/components/landing/StudentJourney.tsx` | Staggered step entrance |
| `src/components/services/ServicesGrid.tsx` | Staggered entrance + icon animation + button press |
| `src/components/educational/MajorCard.tsx` | Refined hover scale + entrance animation |
| `src/pages/ResourcesPage.tsx` | Staggered card entrance + icon micro-animation |
| `src/components/resources/ResourceCard.tsx` | Hover border accent + entrance |
| `src/components/partners/UniversityCard.tsx` | Enhanced shadow depth |
| `src/components/partners/ServiceCard.tsx` | Entrance animation |
| `src/components/partners/InteractiveCard.tsx` | Enhanced shadow |
| `src/components/partnership/NewHowItWorks.tsx` | Card hover + icon scale |
| `src/components/partnership/TrustSection.tsx` | Staggered entrance + hover lift |
| `src/components/partnership/WhyJoinUs.tsx` | Staggered entrance |
| `src/components/quiz/AIQuizChat.tsx` | Message fade-in + button feedback |
| `src/components/chat/AIChatPopup.tsx` | Message fade-in |

### Performance Safeguards
- All animations use `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- `triggerOnce: true` on all intersection observers (fire once, then disconnect)
- No heavy JS animation libraries -- pure CSS transitions + Tailwind
- `will-change` not used globally (browser handles optimization)
- `prefers-reduced-motion` respected via `tailwindcss-animate` plugin

### What Will NOT Change
- Colors, fonts, layout, spacing, or design language
- Navigation order (logo, menu items, student portal button)
- Component structure or functionality
- RTL behavior

