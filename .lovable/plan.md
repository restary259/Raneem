

## Beautify Resources Page -- Background and Card Shadows

### What Changes

**1. Hero Section -- Richer gradient background**
- Replace the subtle `from-primary/5` gradient with a more vibrant multi-stop gradient using the brand colors (primary navy + accent orange highlights)
- Add a subtle decorative pattern/glow effect using CSS pseudo-elements

**2. Tools Section -- Card shadows and background**
- Add a soft background gradient to the tools section
- Give each tool card a visible shadow (`shadow-md`) by default, with a stronger lift on hover (`shadow-2xl`)
- Add a subtle border accent and rounded corners for polish

**3. Guides Section -- Enhanced background contrast**
- Strengthen the muted background from `bg-muted/50` to `bg-muted/30` with a gradient overlay for depth

**4. FAQ Section -- Card visibility**
- Add `shadow-md` and a subtle left border accent (`border-l-4 border-accent`) to each FAQ card
- Add a light background gradient behind the FAQ section for visual separation

**5. Overall page background**
- Add a very subtle gradient or pattern to the page `bg-background` to make it feel less flat

### Technical Details

**File: `src/pages/ResourcesPage.tsx`**

| Section | Current | Updated |
|---------|---------|---------|
| Page wrapper | `bg-background` | `bg-gradient-to-b from-background via-primary/[0.02] to-background` |
| Hero section | `bg-gradient-to-b from-primary/5 to-background` | `bg-gradient-to-br from-primary/10 via-accent/5 to-background` |
| Tools section | `py-12 md:py-20` (no bg) | `py-12 md:py-20 bg-gradient-to-b from-background to-muted/30` |
| Tool cards | `hover:shadow-xl` only | `shadow-md hover:shadow-2xl border-t-2 border-t-accent/20` |
| Guides section | `bg-muted/50` | `bg-gradient-to-b from-muted/40 to-muted/20` |
| FAQ section | no bg | `bg-gradient-to-b from-background to-primary/[0.03]` |
| FAQ cards | default Card | `shadow-md hover:shadow-lg border-l-4 border-l-accent/60 transition-shadow duration-300` |

No new files or dependencies needed. Only the `ResourcesPage.tsx` file is modified with Tailwind utility classes.
