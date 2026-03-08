
## Root Cause

The `AdminSettingsPage` has 5 tab triggers with long Arabic labels in a `TabsList className="flex-wrap"`. The problem is the base `TabsList` component (`src/components/ui/tabs.tsx`) has a **fixed `h-10` (40px) height** — when tabs wrap to a second line due to `flex-wrap`, the container stays 40px and clips the second row of tabs. This makes only the first row visible, and the rest of the tab navigation disappears.

Additionally, `TabsTrigger` has `whitespace-nowrap` which keeps long Arabic strings like "جهات الاتصال المهمة" on one line, making each tab wider and worsening the overflow.

## Fix (CSS-only, 2 files)

### 1. `src/components/ui/tabs.tsx`
Change `TabsList` base class from `h-10` to `h-auto min-h-10` so that when `flex-wrap` is applied externally, the container height expands to fit wrapped rows.

```
// Before
"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"

// After  
"inline-flex h-auto min-h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"
```

### 2. `src/pages/admin/AdminSettingsPage.tsx`
Add `w-full` to the `TabsList` so it fills the container and wraps correctly on mobile:

```tsx
// Before
<TabsList className="flex-wrap">

// After
<TabsList className="flex-wrap w-full h-auto">
```

This ensures:
- The `TabsList` expands vertically when tabs wrap to a second row (fixes clipping)
- All 5 tabs are visible and tappable on mobile
- No logic, data, or translation changes

**Only 2 files touched, CSS classes only.**
