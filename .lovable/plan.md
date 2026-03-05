
## Issues Found & Fixes

### Root Cause: Input Flickering
The `useEffect` in `StudentAuthPage.tsx` has `navigate` in its dependency array (line 79). `navigate` from react-router changes reference on every render, causing the `onAuthStateChange` subscription to be torn down and re-registered every keystroke → forces re-render → flicker.

**Fix**: Move `navigate` out of deps with `useRef`, or wrap `redirectByRole` in `useCallback` with a stable ref.

### Fix Plan

**1. `src/pages/StudentAuthPage.tsx` — 3 changes:**
- Remove `navigate` from `useEffect` deps array (change `[navigate]` to `[]`)
- Wrap `redirectByRole` logic so it uses a `useRef` for navigate to stay stable
- Add a "Back to Website" link at the top of the page (← arrow + "Back to main site")
- The `redirectByRole` function is defined inside the component and referenced in the effect — move it to a stable ref so the effect doesn't need `navigate` in deps

**2. `src/components/landing/MobileNav.tsx` — hamburger persistence:**
- Currently the Sheet doesn't auto-close on navigation. But the user says it's not persisting — need to add `open`/`onOpenChange` state controlled at Sheet level so it stays open until user explicitly closes it (or use `key` to preserve)
- Actually looking at the code the Sheet has no controlled state. Need to add `open` + `onOpenChange` props and only close when user taps a link (with explicit close handler on each Link)

**Files to change:**
| File | Change |
|---|---|
| `src/pages/StudentAuthPage.tsx` | Fix flicker (stable effect), add "Back to home" link |
| `src/components/landing/MobileNav.tsx` | Add controlled open state so hamburger persists properly |

### Visual Result
- Login page: "← Back to main website" link at top, no more flickering
- Mobile nav: Sheet stays open until user explicitly taps a link or the X button
