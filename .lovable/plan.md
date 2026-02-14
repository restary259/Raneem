
## Header Navigation Failure and Mobile UI Stability Fix

This plan addresses 7 critical issues: missing Home button, broken "Who We Are" dropdown, AI Advisor scroll issues, sidebar scroll, Majors page problems, dark mode removal, and full regression cleanup.

---

### Phase 1: Home Button -- Diagnosis and Fix

**Root Cause Found**: The Home button IS present in `DesktopNav.tsx` (line 147-153). The issue is the `overflow-hidden` class on the navigation container in `Header.tsx` (line 38). When the viewport shrinks or zoom increases, the rightmost nav items (including Home, which is last in the RTL list) get clipped by `overflow-hidden`.

**Fix**:
- File: `src/components/landing/Header.tsx` (line 38)
  - Change `overflow-hidden` to `overflow-visible` on the desktop nav container, and use `flex-shrink` with `min-w-0` to let the nav compress without clipping items
- File: `src/components/landing/DesktopNav.tsx` (line 60)
  - Remove `overflow-x-auto` from NavigationMenuList and use `flex-wrap` or ensure items don't get clipped

### Phase 2: "Who We Are" Dropdown Not Opening

**Root Cause Found**: The console shows a `validateDOMNesting` error -- `<a>` cannot appear inside `<a>`. In `DesktopNav.tsx`, navigation links wrap `<Link>` (which renders `<a>`) inside `<NavigationMenuLink>` (which also renders `<a>`). This causes the Radix navigation menu to malfunction.

**Fix**:
- File: `src/components/landing/DesktopNav.tsx`
  - For all plain links (Home, Services, Majors, etc.), use `NavigationMenuLink asChild` with `Link` inside -- matching the pattern already used in `ListItem.tsx`
  - This eliminates the nested `<a>` tags and restores proper Radix state management for dropdowns

### Phase 3: AI Advisor Mobile Scroll Fix

**Current State**: The page uses `h-screen overflow-hidden` on the outer div, but the chat container uses `overflow-y-auto` correctly. The issue is the hard `h-screen` which doesn't account for mobile browser chrome (address bar).

**Fix**:
- File: `src/pages/AIAdvisorPage.tsx`
  - Replace `h-screen` with `h-[100dvh]` (dynamic viewport height) to handle mobile browser chrome
  - Ensure `-webkit-overflow-scrolling: touch` is applied to the scrollable chat area

### Phase 4: Mobile Sidebar Scrollability

**Current State**: The MobileNav Sheet already uses `SheetContent` which has built-in scroll. The issue may be content overflow within the sheet.

**Fix**:
- File: `src/components/landing/MobileNav.tsx`
  - Add `overflow-y-auto max-h-[calc(100vh-4rem)]` to the inner `<nav>` element
  - Convert the "More" section into an accordion/collapsible using the existing `Collapsible` component for cleaner UX with smooth animation

### Phase 5: Majors Page Cleanup

**Issue 1 -- Orange square with broken text**: This is likely a rendering artifact from the search highlight function or a missing translation. The `highlightText` function in `MajorCard.tsx` uses regex splitting which can produce empty fragments.

**Fix**:
- File: `src/components/educational/MajorCard.tsx`
  - Add safety check in `highlightText` to filter out empty parts
  - Ensure all text sources have fallback values

**Issue 2 -- "Choose Your Major" button**: This is the CTA in `CTASection.tsx` or `HeroSection.tsx`. Need to verify the click handler and route.

**Fix**:
- File: `src/components/educational/CTASection.tsx`
  - Verify the button links to `/apply` or scrolls to the majors grid
  - Ensure proper `Link` or `onClick` handler is wired

### Phase 6: Remove Dark Mode Completely

**Scope**: Dark mode is used in 2 files (hook + LanguageSwitcher) and referenced with `dark:` classes in 7 files. The `.dark` CSS block is in `base.css`.

**Files to modify**:

1. `src/hooks/useDarkMode.ts` -- DELETE this file entirely
2. `src/components/common/LanguageSwitcher.tsx` -- Remove dark mode toggle button, remove `useDarkMode` import, keep only the language toggle
3. `src/styles/base.css` -- Remove the entire `.dark { ... }` CSS variable block (lines 38-66)
4. `src/pages/BroadcastPage.tsx` -- Remove `dark:bg-gray-950` and `dark:bg-muted/20` classes
5. `src/pages/ApplyPage.tsx` -- Remove `dark:bg-green-900/30` class
6. `src/components/broadcast/SubmitVideo.tsx` -- Remove `dark:bg-muted/20` class
7. `src/components/calculator/currency-comparator/BestResultCard.tsx` -- Remove all `dark:` classes
8. `src/components/calculator/currency-comparator/ResultsTable.tsx` -- Remove `dark:bg-green-900/20` class
9. `src/components/ui/alert.tsx` -- Remove `dark:border-destructive` class
10. Clear `darb_theme` from localStorage on app init to clean up stale preference

### Phase 7: Regression Cleanup

- Fix the nested `<a>` DOM warning in DesktopNav (covered in Phase 2)
- Ensure Header works at 80%-200% zoom by testing flex behavior
- Verify no `display:none` is applied to nav items (session replay showed this happening)
- Confirm all routes still work after changes

---

### Technical File Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `src/components/landing/Header.tsx` | Fix overflow-hidden clipping nav items |
| 1 | `src/components/landing/DesktopNav.tsx` | Fix overflow-x-auto clipping |
| 2 | `src/components/landing/DesktopNav.tsx` | Fix nested `<a>` tags with `asChild` pattern |
| 3 | `src/pages/AIAdvisorPage.tsx` | Use `100dvh`, add touch scroll |
| 4 | `src/components/landing/MobileNav.tsx` | Add scroll + collapsible "More" section |
| 5 | `src/components/educational/MajorCard.tsx` | Fix highlight function edge cases |
| 5 | `src/components/educational/CTASection.tsx` | Verify CTA button handler |
| 6 | `src/hooks/useDarkMode.ts` | Delete file |
| 6 | `src/components/common/LanguageSwitcher.tsx` | Remove dark toggle, keep language only |
| 6 | `src/styles/base.css` | Remove `.dark` CSS block |
| 6 | 5 component files | Remove `dark:` Tailwind classes |
| 7 | Cross-cutting | Regression verification |

### Implementation Order
1. Phase 2 first (fixes the DOM nesting error which cascades to Phase 1)
2. Phase 1 (header overflow fix)
3. Phase 6 (dark mode removal -- clean sweep)
4. Phase 3 (AI Advisor scroll)
5. Phase 4 (Mobile sidebar)
6. Phase 5 (Majors page)
7. Phase 7 (verification)
