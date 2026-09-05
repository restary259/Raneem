# Remove stray vertical line in the homepage final CTA section

## The line
In `src/components/landing/HomepageExperience.tsx`, the final dark CTA section contains a decorative element:

```tsx
<div className="absolute inset-y-0 end-0 w-1/3 border-s border-primary-foreground/10" aria-hidden="true" />
```

This renders a faint vertical line a third of the way across the section (the circled artifact in the screenshot). It looks like a rendering bug rather than a design element.

## Fix
- Delete that single decorative `div` from the final CTA section.
- No other layout, spacing, or content changes.

## Verification
- Visual check of the final CTA section on desktop and mobile, Arabic and English.
